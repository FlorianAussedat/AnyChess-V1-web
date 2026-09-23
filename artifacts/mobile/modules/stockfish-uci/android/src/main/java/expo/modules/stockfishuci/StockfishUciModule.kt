package expo.modules.stockfishuci

import android.content.pm.ApplicationInfo
import android.os.Build
import android.system.Os
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.File
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Official Stockfish 19 is a statically-linked ELF executable packaged as
 * `jniLibs/arm64-v8a/libstockfish.so` and executed from [ApplicationInfo.nativeLibraryDir].
 *
 * Android 10+ (API 29) W^X: [ProcessBuilder] / `execve` of a file the app wrote under
 * [android.content.Context.getFilesDir] fails with EACCES (error=13) even when
 * [File.setExecutable] / `chmod 0755` succeed. Pixel G1 smoke proved this:
 * the binary was present in filesDir and still could not be spawned.
 * Unix mode bits are not the policy that matters; the kernel refuses execute
 * from writable app-home paths. Do not copy the engine into filesDir.
 */
private const val JNI_LIB_NAME = "libstockfish.so"
private const val LEGACY_FILES_NAME = "stockfish-sf_19"

class StockfishUciException(message: String) : CodedException(message)

class StockfishUciModule : Module() {
  private val lock = Any()
  private val running = AtomicBoolean(false)
  private var process: Process? = null
  private var stdin: BufferedWriter? = null
  private var stdoutThread: Thread? = null
  private val stdinExecutor = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "stockfish-uci-stdin").apply { isDaemon = true }
  }
  private val lifecycleExecutor = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "stockfish-uci-lifecycle").apply { isDaemon = true }
  }

  private val context: android.content.Context
    get() = appContext.reactContext
      ?: throw StockfishUciException("React context unavailable")

  override fun definition() = ModuleDefinition {
    Name("StockfishUci")

    Events("onLine", "onExit", "onError")

    AsyncFunction("start") {
      lifecycleExecutor.submit<Unit> { startEngine() }.get(60, TimeUnit.SECONDS)
    }

    Function("send") { command: String ->
      enqueueSend(command)
    }

    AsyncFunction("terminate") {
      lifecycleExecutor.submit<Unit> { terminateEngine() }.get(5, TimeUnit.SECONDS)
    }

    Function("diagnose") {
      diagnoseBinary()
    }

    OnDestroy {
      killImmediately()
    }

    OnActivityEntersBackground {
      // G1: safest lifecycle is to kill the engine in background. No resume.
      lifecycleExecutor.execute { terminateEngine() }
    }
  }

  private fun startEngine() {
    terminateEngine()
    val snapshot = diagnoseBinary()
    val summary = snapshot["summary"] as String
    val binary = resolveExecutable(summary)
    synchronized(lock) {
      if (running.get()) {
        return
      }
      val pb = ProcessBuilder(binary.absolutePath)
        .redirectErrorStream(true)
        .directory(context.filesDir)
      val started = try {
        pb.start()
      } catch (err: Exception) {
        throw StockfishUciException(
          "Failed to spawn Stockfish: ${err.message}\n$summary",
        )
      }
      process = started
      stdin = BufferedWriter(OutputStreamWriter(started.outputStream, Charsets.UTF_8), 8192)
      running.set(true)
      stdoutThread = Thread({ readStdout(started) }, "stockfish-uci-stdout").apply {
        isDaemon = true
        start()
      }
    }
  }

  private fun readStdout(engine: Process) {
    try {
      BufferedReader(InputStreamReader(engine.inputStream, Charsets.UTF_8)).use { reader ->
        var line: String?
        while (reader.readLine().also { line = it } != null) {
          val trimmed = line?.trim().orEmpty()
          if (trimmed.isNotEmpty()) {
            sendEvent("onLine", mapOf("line" to trimmed))
          }
        }
      }
    } catch (err: Exception) {
      if (running.get()) {
        sendEvent("onError", mapOf("message" to (err.message ?: "stdout read failed")))
      }
    } finally {
      val code = try {
        engine.waitFor()
      } catch (_: Exception) {
        -1
      }
      running.set(false)
      sendEvent("onExit", mapOf("code" to code))
    }
  }

  private fun enqueueSend(command: String) {
    if (!running.get()) return
    val payload = command.replace("\r", "").replace("\n", "").trim()
    if (payload.isEmpty()) return
    stdinExecutor.execute {
      writeCommand(payload)
    }
  }

  private fun writeCommand(command: String) {
    synchronized(lock) {
      val writer = stdin ?: return
      if (!running.get()) return
      try {
        writer.write(command)
        writer.write("\n")
        writer.flush()
      } catch (err: Exception) {
        sendEvent("onError", mapOf("message" to (err.message ?: "stdin write failed")))
      }
    }
  }

  private fun terminateEngine() {
    val engine: Process?
    synchronized(lock) {
      engine = process
      running.set(false)
      try {
        stdin?.write("quit\n")
        stdin?.flush()
      } catch (_: Exception) {
        /* ignore */
      }
      try {
        stdin?.close()
      } catch (_: Exception) {
        /* ignore */
      }
      stdin = null
      process = null
    }

    if (engine == null) {
      stdoutThread = null
      return
    }

    try {
      if (!engine.waitFor(400, TimeUnit.MILLISECONDS)) {
        engine.destroy()
        if (!engine.waitFor(600, TimeUnit.MILLISECONDS)) {
          engine.destroyForcibly()
          engine.waitFor(400, TimeUnit.MILLISECONDS)
        }
      }
    } catch (_: Exception) {
      try {
        engine.destroyForcibly()
      } catch (_: Exception) {
        /* ignore */
      }
    } finally {
      stdoutThread = null
    }
  }

  private fun killImmediately() {
    synchronized(lock) {
      running.set(false)
      try {
        stdin?.close()
      } catch (_: Exception) {
        /* ignore */
      }
      stdin = null
      try {
        process?.destroyForcibly()
      } catch (_: Exception) {
        /* ignore */
      }
      process = null
    }
    stdoutThread = null
  }

  private fun nativeBinary(): File =
    File(context.applicationInfo.nativeLibraryDir, JNI_LIB_NAME)

  private fun filesBinary(): File = File(context.filesDir, LEGACY_FILES_NAME)

  private fun resolveExecutable(summary: String): File {
    val native = nativeBinary()
    if (native.isFile && native.length() > 1_000_000L) {
      return native
    }
    throw StockfishUciException(
      "Stockfish jniLib missing at ${native.absolutePath}. " +
        "Android 10+ cannot exec() from filesDir (W^X / error=13). " +
        "Need extracted $JNI_LIB_NAME (expo.useLegacyPackaging / extractNativeLibs).\n$summary",
    )
  }

  private fun extractNativeLibsFlag(): Boolean {
    val flags = context.applicationInfo.flags
    return flags and ApplicationInfo.FLAG_EXTRACT_NATIVE_LIBS != 0
  }

  private fun posixModeOctal(file: File): String {
    return try {
      val st = Os.stat(file.absolutePath)
      String.format("%o", st.st_mode)
    } catch (err: Exception) {
      "stat-failed:${err.javaClass.simpleName}:${err.message}"
    }
  }

  /**
   * Records chmod / setExecutable results. On filesDir this typically *succeeds*
   * and [File.canExecute] becomes true — then [ProcessBuilder.start] still
   * throws EACCES on API 29+. That is the Pixel G1 failure mode.
   */
  private fun tryMakeExecutable(file: File): String {
    val parts = mutableListOf<String>()
    try {
      parts.add("setExecutable(true,true)=${file.setExecutable(true, true)}")
    } catch (err: Exception) {
      parts.add("setExecutable(true,true)=throw:${err.javaClass.simpleName}:${err.message}")
    }
    try {
      parts.add("setExecutable(true,false)=${file.setExecutable(true, false)}")
    } catch (err: Exception) {
      parts.add("setExecutable(true,false)=throw:${err.javaClass.simpleName}:${err.message}")
    }
    try {
      Os.chmod(file.absolutePath, 493) // 0755
      parts.add("chmod0755=ok")
    } catch (err: Exception) {
      parts.add("chmod0755=throw:${err.javaClass.simpleName}:${err.message}")
    }
    return parts.joinToString("; ")
  }

  private fun fileFacts(file: File, attemptChmod: Boolean): Map<String, Any> {
    val exists = file.exists()
    val facts = linkedMapOf<String, Any>(
      "absolutePath" to file.absolutePath,
      "exists" to exists,
      "length" to if (exists) file.length() else 0L,
      "canRead" to file.canRead(),
      "canExecute" to file.canExecute(),
      "posixMode" to if (exists) posixModeOctal(file) else "n/a",
    )
    if (attemptChmod && exists) {
      facts["setExecutable"] = tryMakeExecutable(file)
      facts["canExecuteAfter"] = file.canExecute()
      facts["posixModeAfter"] = posixModeOctal(file)
    } else {
      facts["setExecutable"] = if (exists) "skipped" else "n/a (missing)"
    }
    return facts
  }

  private fun flatten(prefix: String, facts: Map<String, Any>): List<String> {
    return facts.entries.map { "$prefix.${it.key}=${it.value}" }
  }

  private fun diagnoseBinary(): Map<String, Any> {
    val native = nativeBinary()
    val files = filesBinary()
    val nativeFacts = fileFacts(native, attemptChmod = true)
    val filesFacts = fileFacts(files, attemptChmod = true)
    val spawnSource = if (native.isFile && native.length() > 1_000_000L) {
      "nativeLibraryDir/$JNI_LIB_NAME"
    } else {
      "missing"
    }
    val lines = mutableListOf(
      "sdkInt=${Build.VERSION.SDK_INT}",
      "abis=${Build.SUPPORTED_ABIS.joinToString(",")}",
      "extractNativeLibs=${extractNativeLibsFlag()}",
      "nativeLibraryDir=${context.applicationInfo.nativeLibraryDir}",
      "filesDir=${context.filesDir.absolutePath}",
      "spawnSource=$spawnSource",
      "copyFlush=n/a (no filesDir copy; exec packaged jniLib)",
    )
    lines += flatten("native", nativeFacts)
    lines += flatten("files", filesFacts)
    val summary = lines.joinToString("\n")
    val out = linkedMapOf<String, Any>()
    out["sdkInt"] = Build.VERSION.SDK_INT
    out["abis"] = Build.SUPPORTED_ABIS.joinToString(",")
    out["extractNativeLibs"] = extractNativeLibsFlag()
    out["nativeLibraryDir"] = context.applicationInfo.nativeLibraryDir ?: ""
    out["filesDir"] = context.filesDir.absolutePath
    out["spawnSource"] = spawnSource
    out["copyFlush"] = "n/a (no filesDir copy; exec packaged jniLib)"
    out["absolutePath"] = nativeFacts["absolutePath"] ?: ""
    out["exists"] = nativeFacts["exists"] ?: false
    out["length"] = nativeFacts["length"] ?: 0L
    out["canExecute"] = nativeFacts["canExecuteAfter"] ?: nativeFacts["canExecute"] ?: false
    out["posixMode"] = nativeFacts["posixModeAfter"] ?: nativeFacts["posixMode"] ?: "n/a"
    out["setExecutable"] = nativeFacts["setExecutable"] ?: "n/a"
    out["filesAbsolutePath"] = filesFacts["absolutePath"] ?: ""
    out["filesExists"] = filesFacts["exists"] ?: false
    out["filesLength"] = filesFacts["length"] ?: 0L
    out["filesCanExecute"] = filesFacts["canExecuteAfter"] ?: filesFacts["canExecute"] ?: false
    out["filesPosixMode"] = filesFacts["posixModeAfter"] ?: filesFacts["posixMode"] ?: "n/a"
    out["filesSetExecutable"] = filesFacts["setExecutable"] ?: "n/a"
    out["summary"] = summary
    return out
  }
}
