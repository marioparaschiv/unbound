package app.unbound.android

import android.graphics.Color
import android.graphics.fonts.SystemFonts
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import org.json.JSONObject
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
    external fun nativeDocumentsName(): String

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

    @JvmStatic
    external fun nativeOnJSBundleLoaded()

    @JvmStatic
    external fun nativeInstallMetroModuleCapture(runtimePointer: Long): Boolean

    @JvmStatic
    external fun nativeDrainRuntimeWork(runtimePointer: Long)

    @JvmStatic
    external fun nativeDrainMainWork()

    @JvmStatic
    external fun nativeHermesBytecodeVersion(header: ByteArray): Int

    @JvmStatic
    external fun nativeHookReturnValue(token: String, selfJSON: String, argumentsJSON: String): String?

    @JvmStatic
    external fun nativeToolbox(action: String, argument: String?): String?
    external fun nativePreference(action: String, argument: String?): String?

    fun preferenceEnabled(action: String, argument: String? = null): Boolean =
        nativePreference(action, argument) == "true"

    external fun nativeParseColor(value: String): Long

    fun parseColor(value: String): Int? = nativeParseColor(value).takeIf { it >= 0 }?.toInt()

    fun nativeColor(value: String): Int = parseColor(value) ?: Color.TRANSPARENT

    @JvmStatic
    external fun nativeResolveFont(family: String): String

    @JvmStatic
    external fun nativeThemeColorsJSON(themeId: String): String

    @JvmStatic
    external fun nativePrepareAddons()

    @JvmStatic
    external fun nativeLog(level: Int, category: String, message: String)

    @JvmStatic
    external fun nativeDevOverlayButtonSide(): Double

    @JvmStatic
    external fun nativeDevOverlayCenter(bounds: DoubleArray): DoubleArray?

    @JvmStatic
    external fun nativeClampDevOverlayCenter(x: Double, y: Double, bounds: DoubleArray): DoubleArray?

    @JvmStatic
    external fun nativeSaveDevOverlayCenter(x: Double, y: Double, bounds: DoubleArray)

    @JvmStatic
    fun scheduleRuntimeWork() {
        ReactRuntime.post { runtimePointer -> nativeDrainRuntimeWork(runtimePointer) }
    }

    @JvmStatic
    fun installMetroModuleCaptureBeforeBundle() {
        ReactRuntime.runBeforeBundle { runtimePointer -> nativeInstallMetroModuleCapture(runtimePointer) }
    }

    @JvmStatic
    fun scheduleMainWork() {
        Handler(Looper.getMainLooper()).post { nativeDrainMainWork() }
    }

    @JvmStatic
    fun isMainThread(): Boolean = Looper.myLooper() == Looper.getMainLooper()

    @JvmStatic
    fun lookupViews(queryJSON: String): String = NativeUI.lookup(queryJSON)

    @JvmStatic
    fun snapshotViews(queryJSON: String): String = NativeUI.snapshot(queryJSON)

    @JvmStatic
    fun measureView(handleJSON: String): String = NativeUI.measureView(handleJSON)

    @JvmStatic
    fun setViewFrame(handleJSON: String, frameJSON: String) =
        NativeUI.setViewFrame(handleJSON, frameJSON)

    @JvmStatic
    fun mountView(containerHandleJSON: String, moduleName: String, propertiesJSON: String): String =
        NativeUI.mountView(containerHandleJSON, moduleName, propertiesJSON)

    @JvmStatic
    fun updateView(handleJSON: String, propertiesJSON: String) =
        NativeUI.updateView(handleJSON, propertiesJSON)

    @JvmStatic
    fun unmountView(handleJSON: String) = NativeUI.unmountView(handleJSON)

    @JvmStatic
    external fun nativeDispatchHookEvent(token: String, payloadJSON: String)

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
            NativeUI.unmountAll()
        }
    }

    @JvmStatic
    fun javaGetClass(name: String): String = NativeJava.getClass(name)

    @JvmStatic
    fun javaClassName(handleJSON: String): String = NativeJava.className(handleJSON)

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
    fun javaGetField(handleJSON: String, name: String): String =
        NativeJava.getField(handleJSON, name)

    @JvmStatic
    fun javaSetField(handleJSON: String, name: String, valueJSON: String) =
        NativeJava.setField(handleJSON, name, valueJSON)

    @JvmStatic
    fun javaRelease(handleJSON: String) = NativeJava.release(handleJSON)

    @JvmStatic
    fun javaBatch(operationsJSON: String): String = NativeJava.batch(operationsJSON)

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
                    return null
                }
            }
            arrayOf(status.toString(), connection.getHeaderField("etag") ?: "")
        } finally {
            deadline.cancel(false)
            connection.disconnect()
        }
    }.onFailure { Logger.error(LogCategory.UPDATER, "Bundle download failed: $it") }.getOrNull()

    @JvmStatic
    fun devServerHost(): String? = Platform.emulatorHostAddress()

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
    fun onBundleExecuted() {
        Logger.info(LogCategory.DEFAULT, "Bundle executed.")
    }


}
