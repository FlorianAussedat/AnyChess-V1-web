package expo.modules.stockfishuci

import android.content.Context
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.File
import java.io.FileOutputStream
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

private const val ASSET_DIR = "stockfish"
private const val ASSET_BIN = "stockfish.sfbin"
private const val ASSET_VERSION = "VERSION.txt"
private const val DEST_NAME = "stockfish-sf_19"

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

  private val context: Context
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
    val binary = ensureBinary()
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
        throw StockfishUciException("Failed to spawn Stockfish: ${err.message}")
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

  private fun ensureBinary(): File {
    val dest = File(context.filesDir, DEST_NAME)
    val marker = File(context.filesDir, "$DEST_NAME.version")
    val expected = readAssetText("$ASSET_DIR/$ASSET_VERSION")
    if (dest.exists() && dest.canExecute() && dest.length() > 1_000_000L && marker.exists()) {
      if (marker.readText() == expected) {
        return dest
      }
    }

    dest.parentFile?.mkdirs()
    try {
      context.assets.open("$ASSET_DIR/$ASSET_BIN").use { input ->
        FileOutputStream(dest).use { output ->
          input.copyTo(output, DEFAULT_BUFFER_SIZE)
        }
      }
    } catch (err: Exception) {
      throw StockfishUciException(
        "Stockfish binary missing from assets ($ASSET_DIR/$ASSET_BIN): ${err.message}",
      )
    }

    if (!dest.setExecutable(true, true)) {
      throw StockfishUciException("Could not chmod +x ${dest.absolutePath}")
    }
    dest.setReadable(true, true)
    marker.writeText(expected)
    return dest
  }

  private fun readAssetText(path: String): String {
    return try {
      context.assets.open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }
    } catch (_: Exception) {
      "sf_19"
    }
  }
}
