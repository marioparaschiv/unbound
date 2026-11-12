package app.unbound.android

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.graphics.fonts.SystemFonts
import android.net.ConnectivityManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import android.widget.Toast
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

object NativeBridge {
    private val downloadWatchdog = Executors.newSingleThreadScheduledExecutor {
        Thread(it, "unbound-download-watchdog").apply { isDaemon = true }
    }

    @JvmStatic
    external fun nativeDocumentsDirectory(parent: String): String

    @JvmStatic
    external fun nativeSettingsFileName(): String

    @Volatile
    var documents: String = ""

    @JvmStatic
    external fun nativeInitialize(
        documents: String,
        bootstrapScripts: String,
        origin: String,
        bytecodeVersion: Int,
        platformInfo: String,
    )

    @JvmStatic
    external fun nativeOnLoadJSBundle()

    /** Whether [url] is one of Discord's analytics endpoints and the loader is set to block them. */
    @JvmStatic
    external fun nativeIsBlockedTelemetry(url: String): Boolean

    /** Counts this launch as healthy: Discord left the foreground without crashing. */
    @JvmStatic
    external fun nativeMarkHealthy()

    /** Discord came back to the foreground; the loader checks for a newer bundle if one is due. */
    @JvmStatic
    external fun nativeOnForeground()

    @JvmStatic
    external fun nativeOnBackground()

    @JvmStatic
    external fun nativeAdoptTombstone(tombstone: ByteArray): Boolean

    /** How long this launch took to reach each step, as text for the toolbox. */
    @JvmStatic
    external fun nativeLaunchTimings(): String

    /**
     * How Discord's main process last ended: 1 for a crash, a freeze or a failed start; 2 when the person or the
     * system ended it; 0 when Android keeps no record (before Android 11).
     */
    @JvmStatic
    fun previousExit(): Int = runCatching {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return 0
        val context = Platform.application() ?: return 0
        val manager = context.getSystemService(ActivityManager::class.java) ?: return 0
        val exit = manager.getHistoricalProcessExitReasons(context.packageName, 0, 8)
            .firstOrNull { it.processName == context.packageName } ?: return 0
        if (exit.reason == ApplicationExitInfo.REASON_CRASH_NATIVE) adoptTombstone(exit)
        when (exit.reason) {
            ApplicationExitInfo.REASON_CRASH,
            ApplicationExitInfo.REASON_CRASH_NATIVE,
            ApplicationExitInfo.REASON_ANR,
            ApplicationExitInfo.REASON_INITIALIZATION_FAILURE,
            -> 1

            ApplicationExitInfo.REASON_UNKNOWN -> 0

            else -> 2
        }
    }.getOrDefault(0)

    private fun adoptTombstone(exit: ApplicationExitInfo) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        runCatching {
            val bytes = exit.traceInputStream?.use { stream ->
                val buffer = java.io.ByteArrayOutputStream()
                val chunk = ByteArray(16 * 1024)
                while (buffer.size() < MAX_TOMBSTONE_BYTES) {
                    val read = stream.read(chunk)
                    if (read < 0) break
                    buffer.write(chunk, 0, read)
                }
                buffer.toByteArray()
            } ?: return
            if (nativeAdoptTombstone(bytes)) {
                Logger.info(LogCategory.DEFAULT, "Read the previous native crash's stack from Android's tombstone.")
            }
        }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to read Android's tombstone", it) }
    }

    private const val MAX_TOMBSTONE_BYTES = 4 * 1024 * 1024

    /** Whether the active network costs the person data: mobile data, a hotspot or Data Saver. */
    @JvmStatic
    fun isMeteredNetwork(): Boolean = runCatching {
        val context = Platform.application() ?: return false
        context.getSystemService(Context.CONNECTIVITY_SERVICE).let { it as ConnectivityManager }.isActiveNetworkMetered
    }.getOrDefault(false)

    @JvmStatic
    external fun nativeEvictIdleSurfaces()

    @JvmStatic
    external fun nativeOnRuntimeCreated(runtimePointer: Long): Boolean

    @JvmStatic
    external fun nativeDrainRuntimeWork(runtimePointer: Long)

    @JvmStatic
    external fun nativeInstallSchedulerDrain(runtimePointer: Long): Boolean

    @JvmStatic
    external fun nativeDrainMainWork()

    @JvmStatic
    external fun nativeDrainFrameWork()

    @JvmStatic
    external fun nativeHermesBytecodeVersion(header: ByteArray): Int

    @JvmStatic
    external fun nativeHookReturnValue(token: String, selfJSON: String, argumentsJSON: String): String?

    @JvmStatic
    external fun nativeToolbox(action: String, argument: String?): String?

    /** The theme to apply, or null when none is applied or Recovery Mode is on. */
    @JvmStatic
    external fun nativeActiveThemeId(): String?

    @JvmStatic
    external fun nativeRecoveryActionLabel(): String?

    @JvmStatic
    external fun nativeGestureEnabled(gesture: String): Boolean

    @JvmStatic
    external fun nativeSetGestureEnabled(gesture: String, enabled: Boolean)

    @JvmStatic
    external fun nativeDevOverlayVisible(virtualDevice: Boolean, debugBuild: Boolean): Boolean

    @JvmStatic
    external fun nativeToolboxHoldMilliseconds(): Long

    @JvmStatic
    external fun nativeShakeSample(x: Float, y: Float, z: Float, milliseconds: Long): Boolean

    @JvmStatic
    external fun nativeThreeFingerEvent(event: String, pointers: Int): String

    @JvmStatic
    external fun nativeResolveFont(family: String): String

    @JvmStatic
    external fun nativeThemeColorsJSON(themeId: String): String

    @JvmStatic
    external fun nativePrepareAddons()

    @JvmStatic
    external fun nativeLog(level: Int, category: String, message: String)

    @JvmStatic
    external fun nativeAppendLogFile(level: Int, category: String, message: String)

    @JvmStatic
    external fun nativeDevOverlayButtonSide(): Double

    @JvmStatic
    external fun nativeAttestation(): String

    @JvmStatic
    external fun nativeWarnOffMainViewCall(call: String)

    @JvmStatic
    external fun nativeIncompatibleHostMessage(): String

    @JvmStatic
    external fun nativeDevelopmentBuildBanner(commit: String, subject: String, branch: String, timestamp: String): String

    @JvmStatic
    external fun nativeDevelopmentBuildBannerSeconds(): Int

    @JvmStatic
    external fun nativeDevOverlayCenter(bounds: DoubleArray): DoubleArray?

    @JvmStatic
    external fun nativeClampDevOverlayCenter(x: Double, y: Double, bounds: DoubleArray): DoubleArray?

    @JvmStatic
    external fun nativeSaveDevOverlayCenter(x: Double, y: Double, bounds: DoubleArray)

    @JvmStatic
    fun scheduleRuntimeWork(throughScheduler: Boolean) {
        if (throughScheduler && ReactRuntime.postThroughScheduler()) return
        ReactRuntime.post { runtimePointer -> nativeDrainRuntimeWork(runtimePointer) }
    }

    @JvmStatic
    fun runBundleBeforeDiscord() {
        ReactRuntime.runBeforeBundle { runtimePointer ->
            nativeOnRuntimeCreated(runtimePointer)
            if (nativeInstallSchedulerDrain(runtimePointer)) ReactRuntime.enableSchedulerRoute(runtimePointer)
        }
    }

    @JvmStatic
    fun isVerifiedBuild(): Boolean = Attestation.current().verified

    @JvmStatic
    fun installer(action: String, argument: String?): String? = DiscordInstaller.call(action, argument)

    @JvmStatic
    fun scheduleMainWork() {
        Handler(Looper.getMainLooper()).post { nativeDrainMainWork() }
    }

    @JvmStatic
    fun scheduleMainFrameWork() {
        Handler(Looper.getMainLooper()).post {
            Choreographer.getInstance().postFrameCallback { nativeDrainFrameWork() }
        }
    }

    @JvmStatic
    fun isMainThread(): Boolean = Looper.myLooper() == Looper.getMainLooper()

    @JvmStatic
    external fun nativeDispatchHookEvent(token: String, payloadJSON: String): String?

    @JvmStatic
    fun hooksInstall(
        className: String,
        methodName: String,
        parametersJSON: String,
        optionsJSON: String,
    ): String = NativeHooks.hook(className, methodName, parametersJSON, optionsJSON)

    @JvmStatic
    fun hooksRemove(tokenJSON: String) = NativeHooks.remove(tokenJSON)

    @JvmStatic
    fun fabricMount(containerHandleJSON: String, moduleName: String, propsJSON: String): String =
        NativeFabric.mount(containerHandleJSON, moduleName, propsJSON)

    @JvmStatic
    fun fabricUpdate(handleJSON: String, propsJSON: String) =
        NativeFabric.update(handleJSON, propsJSON)

    @JvmStatic
    fun fabricUnmount(handleJSON: String): Boolean = NativeFabric.unmount(handleJSON)

    @JvmStatic
    fun fabricDetach(handleJSON: String): Boolean = NativeFabric.detach(handleJSON)

    @JvmStatic
    fun fabricAttach(handleJSON: String, containerHandleJSON: String) =
        NativeFabric.attach(handleJSON, containerHandleJSON)

    @JvmStatic
    fun fabricSetSize(handleJSON: String, minimumJSON: String, maximumJSON: String) =
        NativeFabric.setSize(handleJSON, minimumJSON, maximumJSON)

    @JvmStatic
    fun fabricSetFrame(handleJSON: String, frameJSON: String) =
        NativeFabric.setFrame(handleJSON, frameJSON)

    @JvmStatic
    fun fabricMeasure(handleJSON: String): String = NativeFabric.measure(handleJSON)

    @JvmStatic
    fun runtimeReplaced() {
        NativeHooks.removeAll()
        NativeJava.releaseAll()
        Handler(Looper.getMainLooper()).post {
            NativeFabric.unmountAll()
        }
    }

    @JvmStatic
    fun javaGetClass(name: String): String = NativeJava.getClass(name)

    @JvmStatic
    fun javaClassName(handleJSON: String): String = NativeJava.className(handleJSON)

    @JvmStatic
    fun javaDescribe(name: String): String = NativeJava.describe(name)

    @JvmStatic
    fun javaConstruct(name: String, argumentsJSON: String): String =
        NativeJava.construct(name, argumentsJSON)

    @JvmStatic
    fun javaRespondsTo(handleJSON: String, name: String, argumentsJSON: String): String =
        NativeJava.respondsTo(handleJSON, name, argumentsJSON)

    @JvmStatic
    fun javaInvoke(handleJSON: String, name: String, argumentsJSON: String): String =
        NativeJava.invoke(handleJSON, name, argumentsJSON)

    @JvmStatic
    fun javaPrepare(handleJSON: String, name: String, parameterTypesJSON: String): String =
        NativeJava.prepare(handleJSON, name, parameterTypesJSON)

    @JvmStatic
    fun javaInvokePrepared(planJSON: String, handleJSON: String, argumentsJSON: String): String =
        NativeJava.invokePrepared(planJSON, handleJSON, argumentsJSON)

    @JvmStatic
    fun javaDisposePlan(planJSON: String) = NativeJava.disposePlan(planJSON)

    @JvmStatic
    fun javaGetField(handleJSON: String, name: String): String =
        NativeJava.getField(handleJSON, name)

    @JvmStatic
    fun javaSetField(handleJSON: String, name: String, valueJSON: String) =
        NativeJava.setField(handleJSON, name, valueJSON)

    @JvmStatic
    fun javaRelease(handleJSON: String) = NativeJava.release(handleJSON)

    @JvmStatic
    fun javaLiveHandles(): Int = NativeJava.liveHandles()

    @JvmStatic
    fun javaBatch(operationsJSON: String): String = NativeJava.batch(operationsJSON)

    @JvmStatic
    fun javaFindViews(handleJSON: String, className: String, optionsJSON: String): String =
        NativeJava.findViews(handleJSON, className, optionsJSON)

    @JvmStatic
    fun javaCreateAssociationKey(): String = NativeJava.createAssociationKey()

    @JvmStatic
    fun javaGetAssociatedObject(handleJSON: String, keyJSON: String): String =
        NativeJava.getAssociatedObject(handleJSON, keyJSON)

    @JvmStatic
    fun javaSetAssociatedObject(handleJSON: String, keyJSON: String, valueJSON: String, maximumPerObject: Int) =
        NativeJava.setAssociatedObject(handleJSON, keyJSON, valueJSON, maximumPerObject)

    @JvmStatic
    fun fetchText(url: String, timeoutMs: Int): String? = runCatching {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = timeoutMs
        connection.readTimeout = timeoutMs
        connection.useCaches = false
        try {
            if (connection.responseCode != HttpURLConnection.HTTP_OK) return null
            connection.inputStream.bufferedReader().use { it.readText() }
        } finally {
            connection.disconnect()
        }
    }.getOrNull()

    @JvmStatic
    fun download(
        url: String,
        destination: String,
        headerKeys: Array<String>,
        headerValues: Array<String>,
        connectTimeoutMs: Int,
        readTimeoutMs: Int,
        totalTimeoutMs: Int,
    ): Array<String>? = runCatching {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = connectTimeoutMs
        connection.readTimeout = readTimeoutMs
        connection.useCaches = false
        headerKeys.zip(headerValues).forEach { (key, value) -> connection.setRequestProperty(key, value) }
        val deadline = downloadWatchdog.schedule({ connection.disconnect() }, totalTimeoutMs.toLong(), TimeUnit.MILLISECONDS)

        try {
            val status = connection.responseCode
            if (status == HttpURLConnection.HTTP_OK) {
                val target = File(destination)
                target.parentFile?.mkdirs()
                val staging = File("$destination.download")
                connection.inputStream.use { input -> staging.outputStream().use { input.copyTo(it) } }
                if (!staging.renameTo(target)) {
                    staging.delete()
                    Logger.info(LogCategory.UPDATER, "Downloading $url failed: the bundle could not be saved to $destination")
                    return null
                }
            }
            arrayOf(status.toString(), connection.getHeaderField("etag") ?: "", connection.getHeaderField("Retry-After") ?: "")
        } finally {
            deadline.cancel(false)
            connection.disconnect()
        }
    }.onFailure { Logger.info(LogCategory.UPDATER, "Downloading $url failed: ${downloadFailureReason(it)}") }.getOrNull()

    fun downloadFailureReason(error: Throwable): String =
        listOfNotNull(error::class.java.simpleName, error.message).joinToString(": ")

    @JvmStatic
    fun devServerHost(): String? = Platform.emulatorHostAddress()

    @JvmStatic
    fun installHomeScreenIcon(name: String, imagePath: String): Boolean = HomeScreenShortcuts.pin(name, imagePath)

    @JvmStatic
    fun isServing(url: String, timeoutMs: Int): Boolean = runCatching {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.requestMethod = "HEAD"
        connection.connectTimeout = timeoutMs
        connection.readTimeout = timeoutMs
        try {
            connection.responseCode == HttpURLConnection.HTTP_OK
        } finally {
            connection.disconnect()
        }
    }.getOrDefault(false)

    private const val APP_FONTS_DIRECTORY = "fonts"

    @JvmStatic
    fun appFonts(): Array<String> = runCatching {
        val assets = Platform.application()?.assets ?: return emptyArray()
        assets.list(APP_FONTS_DIRECTORY).orEmpty()
            .filter { it.endsWith(".ttf", true) || it.endsWith(".otf", true) }
            .map { "$APP_FONTS_DIRECTORY/$it" }
            .toTypedArray()
    }.getOrDefault(emptyArray())

    @JvmStatic
    fun appFontBytes(path: String): ByteArray? = runCatching {
        Platform.application()?.assets?.open(path)?.use { it.readBytes() }
    }.getOrNull()

    @JvmStatic
    fun availableFonts(): Array<String> = runCatching {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return emptyArray()
        SystemFonts.getAvailableFonts()
            .mapNotNull { it.file?.absolutePath }
            .distinct()
            .toTypedArray()
    }.getOrDefault(emptyArray())

    @JvmStatic
    fun alert(message: String) {
        Handler(Looper.getMainLooper()).post {
            val context = Platform.application() ?: return@post
            Toast.makeText(context, message, Toast.LENGTH_LONG).show()
        }
    }

    @JvmStatic
    fun crashAlert(message: String) {
        StartupAlert.reportCrash(message)
    }

    private var updateToast: Toast? = null

    /** Shows "Updating Unbound…" while Discord's launch waits for Unbound's bundle to download. */
    @JvmStatic
    fun updateProgress(showing: Boolean) {
        Handler(Looper.getMainLooper()).post {
            updateToast?.cancel()
            updateToast = null
            if (!showing) return@post
            val context = Platform.application() ?: return@post
            updateToast = Toast.makeText(context, "Updating Unbound…", Toast.LENGTH_LONG).also { it.show() }
        }
    }

    @JvmStatic
    fun onBundleExecuted() {
        Logger.info(LogCategory.DEFAULT, "Bundle executed.")
    }

    /** Called by the font store after each write, from the thread that wrote. */
    @JvmStatic
    fun fontsChanged() {
        Fonts.changed()
    }
}
