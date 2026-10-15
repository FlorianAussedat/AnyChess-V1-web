package expo.modules.voskasr

import android.Manifest
import android.content.pm.PackageManager
import android.os.StatFs
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import org.vosk.android.RecognitionListener
import org.vosk.android.SpeechService
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.zip.ZipInputStream

class VoskAsrModule : Module() {
  private val io = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "vosk-asr").apply { isDaemon = true }
  }
  private val cancelDownload = AtomicBoolean(false)
  private val pauseDownload = AtomicBoolean(false)
  private val activeSession = AtomicInteger(-1)
  /** Latest start requested by JS. A stop or a newer start supersedes an older one. */
  private val requestedSession = AtomicInteger(-1)

  private var model: Model? = null
  private var modelPath: String? = null
  private var recognizer: Recognizer? = null
  private var speech: SpeechService? = null
  private var grammarJson: String = "[]"

  private val context: android.content.Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context unavailable")

  override fun definition() = ModuleDefinition {
    Name("VoskAsr")

    Events("onResult", "onError", "onProgress", "onDownloadDone")

    AsyncFunction("download") { url: String, destPath: String, sha256: String ->
      cancelDownload.set(false)
      pauseDownload.set(false)
      io.submit<Unit> {
        try {
          downloadFile(url, File(destPath), sha256)
          sendEvent("onDownloadDone", mapOf("ok" to true, "path" to destPath))
        } catch (err: Exception) {
          if (cancelDownload.get()) {
            sendEvent("onDownloadDone", mapOf("ok" to false, "reason" to "cancelled"))
          } else {
            sendEvent(
              "onDownloadDone",
              mapOf("ok" to false, "reason" to reasonOf(err), "message" to (err.message ?: "")),
            )
          }
        }
      }
    }

    Function("cancelDownload") {
      cancelDownload.set(true)
    }

    Function("pauseDownload") {
      pauseDownload.set(true)
    }

    Function("freeBytes") {
      StatFs(context.filesDir.absolutePath).availableBytes.toDouble()
    }

    Function("paths") { language: String ->
      val safe = if (language == "en") "en" else "fr"
      val base = File(context.filesDir, "vosk")
      val root = File(base, safe)
      mapOf(
        // The archive stays beside the model directory so install can replace the directory.
        "zip" to File(base, "$safe.download.zip").absolutePath,
        "root" to root.absolutePath,
      )
    }

    Function("status") { language: String, directory: String ->
      val safe = if (language == "en") "en" else "fr"
      val root = File(context.filesDir, "vosk/$safe")
      val modelDir = File(root, directory)
      val ready = File(root, "READY")
      val filesOk = File(modelDir, "conf/model.conf").isFile && File(modelDir, "am/final.mdl").isFile
      val marked = ready.isFile && ready.readText().trim() == directory
      when {
        marked && filesOk -> "installed"
        else -> "missing"
      }
    }

    AsyncFunction("install") { zipPath: String, destDir: String, sha256: String, directory: String ->
      io.submit<String> {
        val zip = File(zipPath)
        val root = File(destDir)
        val zipCanon = zip.canonicalPath
        val rootPrefix = root.canonicalPath + File.separator
        if (zipCanon == root.canonicalPath || zipCanon.startsWith(rootPrefix)) {
          throw IllegalStateException("integrity")
        }
        if (!sha256.equals(hashFile(zip), ignoreCase = true)) {
          zip.delete()
          throw IllegalStateException("integrity")
        }
        if (root.exists()) root.deleteRecursively()
        root.mkdirs()
        unzip(zip, root)
        zip.delete()
        val modelDir = File(root, directory)
        if (!File(modelDir, "conf/model.conf").isFile || !File(modelDir, "am/final.mdl").isFile) {
          root.deleteRecursively()
          throw IllegalStateException("incompatible")
        }
        modelDir.absolutePath
      }.get()
    }

    AsyncFunction("load") { path: String ->
      io.submit<Unit> {
        if (modelPath == path && model != null) return@submit
        stopListening()
        recognizer?.close()
        recognizer = null
        model?.close()
        tuneDecoder(File(path))
        model = Model(path)
        modelPath = path
        recognizer = Recognizer(model, SAMPLE_RATE, grammarJson).also {
          it.setMaxAlternatives(MAX_ALTERNATIVES)
          it.setWords(true)
        }
        val modelDir = File(path)
        File(modelDir.parentFile, "READY").writeText(modelDir.name)
      }.get()
    }

    Function("setGrammar") { json: String ->
      grammarJson = if (json.isBlank()) "[]" else json
      io.execute { recognizer?.setGrammar(grammarJson) }
    }

    Function("hasMicPermission") {
      ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
        PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("start") { sessionId: Int ->
      requestedSession.set(sessionId)
      io.submit<Unit> {
        if (requestedSession.get() != sessionId) return@submit
        if (!hasPermission()) throw IllegalStateException("permission")
        val rec = recognizer ?: throw IllegalStateException("model")
        stopListening()
        if (requestedSession.get() != sessionId) return@submit
        rec.setGrammar(grammarJson)
        activeSession.set(sessionId)
        val service = SpeechService(rec, SAMPLE_RATE)
        speech = service
        service.startListening(listener)
      }.get()
    }

    Function("stop") {
      requestedSession.set(-1)
      activeSession.set(-1)
      io.execute { stopListening() }
    }

    OnDestroy {
      cancelDownload.set(true)
      requestedSession.set(-1)
      activeSession.set(-1)
      io.execute {
        stopListening()
        recognizer?.close()
        recognizer = null
        model?.close()
        model = null
      }
    }

    OnActivityEntersBackground {
      requestedSession.set(-1)
      activeSession.set(-1)
      io.execute { stopListening() }
    }
  }

  private fun hasPermission(): Boolean {
    return ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
      PackageManager.PERMISSION_GRANTED
  }

  private fun stopListening() {
    try {
      speech?.stop()
    } catch (_: Exception) {
    }
    try {
      speech?.shutdown()
    } catch (_: Exception) {
    }
    speech = null
  }

  private val listener = object : RecognitionListener {
    override fun onPartialResult(hypothesis: String?) = Unit

    override fun onResult(hypothesis: String?) {
      emitHypothesis(hypothesis)
    }

    override fun onFinalResult(hypothesis: String?) {
      emitHypothesis(hypothesis)
    }

    override fun onError(exception: Exception?) {
      sendEvent(
        "onError",
        mapOf(
        "session" to activeSession.get(),
        "message" to (exception?.message ?: "recognition"),
        ),
      )
    }

    override fun onTimeout() = Unit
  }

  private fun emitHypothesis(hypothesis: String?) {
    if (hypothesis.isNullOrBlank()) return
    val alternatives = parseAlternatives(hypothesis)
    if (alternatives.isEmpty()) return
    sendEvent(
      "onResult",
      mapOf(
        "session" to activeSession.get(),
        "alternatives" to alternatives,
      ),
    )
  }

  private fun downloadFile(url: String, dest: File, expectedSha: String) {
    downloadFile(url, dest, expectedSha, resume = true)
  }

  private fun downloadFile(url: String, dest: File, expectedSha: String, resume: Boolean) {
    dest.parentFile?.mkdirs()
    var existing = if (resume && dest.exists()) dest.length() else 0L
    if (!resume && dest.exists()) dest.delete()
    val connection = open(url, existing)
    try {
      val code = connection.responseCode
      if (code == 416 && existing > 0L && resume) {
        connection.disconnect()
        if (expectedSha.equals(hashFile(dest), ignoreCase = true)) return
        dest.delete()
        downloadFile(url, dest, expectedSha, resume = false)
        return
      }
      if (code != HttpURLConnection.HTTP_PARTIAL && code != HttpURLConnection.HTTP_OK) {
        throw IllegalStateException("network")
      }
      if (code == HttpURLConnection.HTTP_OK) existing = 0L
      val totalHeader = connection.getHeaderField("Content-Length")?.toLongOrNull() ?: -1L
      val total = if (code == HttpURLConnection.HTTP_PARTIAL && totalHeader >= 0) {
        existing + totalHeader
      } else {
        totalHeader
      }
      val stat = StatFs(dest.parentFile?.absolutePath ?: dest.absolutePath)
      val remaining = if (total > existing) total - existing else if (total > 0) total else 0
      if (total > 0 && stat.availableBytes < remaining + UNPACK_HEADROOM) {
        throw IllegalStateException("space")
      }
      connection.inputStream.use { input ->
        FileOutputStream(dest, code == HttpURLConnection.HTTP_PARTIAL).use { output ->
          val buffer = ByteArray(64 * 1024)
          var received = existing
          while (true) {
            if (cancelDownload.get()) throw IllegalStateException("cancelled")
            if (pauseDownload.get()) throw IllegalStateException("paused")
            val read = input.read(buffer)
            if (read < 0) break
            output.write(buffer, 0, read)
            received += read
            sendEvent(
              "onProgress",
              mapOf("received" to received.toDouble(), "total" to total.toDouble()),
            )
          }
        }
      }
    } finally {
      connection.disconnect()
    }
    if (!expectedSha.equals(hashFile(dest), ignoreCase = true)) {
      dest.delete()
      throw IllegalStateException("integrity")
    }
  }

  private fun open(url: String, existing: Long): HttpURLConnection {
    val connection = (URL(url).openConnection() as HttpURLConnection).apply {
      instanceFollowRedirects = true
      connectTimeout = 20_000
      readTimeout = 60_000
      if (existing > 0L) setRequestProperty("Range", "bytes=$existing-")
    }
    connection.connect()
    return connection
  }

  private fun hashFile(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { input ->
      val buffer = ByteArray(64 * 1024)
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
  }

  private fun unzip(zip: File, dest: File) {
    ZipInputStream(FileInputStream(zip)).use { input ->
      while (true) {
        val entry = input.nextEntry ?: break
        val out = File(dest, entry.name)
        val canonicalDest = dest.canonicalPath + File.separator
        if (!out.canonicalPath.startsWith(canonicalDest) && out.canonicalPath != dest.canonicalPath) {
          throw IllegalStateException("integrity")
        }
        if (entry.isDirectory) {
          out.mkdirs()
        } else {
          out.parentFile?.mkdirs()
          FileOutputStream(out).use { output -> input.copyTo(output) }
        }
        input.closeEntry()
      }
    }
  }

  private fun parseAlternatives(hypothesis: String): List<Map<String, Any>> {
    val json = try {
      JSONObject(hypothesis)
    } catch (_: Exception) {
      return emptyList()
    }
    val list = mutableListOf<Map<String, Any>>()
    val alternatives = json.optJSONArray("alternatives")
    if (alternatives != null) {
      for (i in 0 until alternatives.length()) {
        val item = alternatives.optJSONObject(i) ?: continue
        addAlternative(list, item.optString("text"), item.optDouble("confidence", 0.0))
      }
    } else {
      addAlternative(list, json.optString("text"), 0.0)
    }
    return list
  }

  private fun addAlternative(list: MutableList<Map<String, Any>>, raw: String, score: Double) {
    val text = raw.split(Regex("\\s+")).filter { it.isNotBlank() && it != "[unk]" }.joinToString(" ")
    // Keep an empty hypothesis when the best path is unknown, so a weaker chess fragment cannot win.
    if (text.isBlank()) {
      if (raw.isNotBlank()) list.add(mapOf("text" to "", "score" to score))
      return
    }
    list.add(mapOf("text" to text, "score" to score))
  }

  private fun reasonOf(err: Exception): String {
    val message = (err.message ?: "").lowercase()
    return when {
      message.contains("integrity") || message.contains("incompatible") -> message
      message.contains("enospc") || message.contains("no space") -> "space"
      message.contains("paused") -> "paused"
      message.contains("cancelled") -> "cancelled"
      else -> "network"
    }
  }

  private fun tuneDecoder(modelDir: File) {
    val conf = File(modelDir, "conf/model.conf")
    if (!conf.isFile) return
    val text = conf.readText()
    val match = Regex("(?m)^--lattice-beam=(\\S+)").find(text) ?: return
    val value = match.groupValues[1].toDoubleOrNull() ?: return
    if (value >= 4.0) return
    val tuned = text
      .replace(Regex("(?m)^--beam=.*$"), "--beam=15.0")
      .replace(Regex("(?m)^--lattice-beam=.*$"), "--lattice-beam=8.0")
      .replace(Regex("(?m)^--max-active=.*$"), "--max-active=7000")
    if (tuned != text) conf.writeText(tuned)
  }

  companion object {
    private const val SAMPLE_RATE = 16000.0f
    private const val MAX_ALTERNATIVES = 8
    /** Zip and unpacked model overlap, plus a small margin. */
    private const val UNPACK_HEADROOM = 80_000_000L
  }
}
