package app.unbound.android

import android.graphics.fonts.SystemFonts
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

object NativeBridge {
    private const val DEV_SERVER_PORT = 3000
    private const val DEV_SERVER_PROBE = "manifest.json"
    private const val EMULATOR_HOST = "10.0.2.2"
    private const val DEV_SERVER_PROBE_TIMEOUT_MS = 1500

    @JvmStatic
    external fun nativeInitialize(
        documents: String,
        devtoolsScript: String?,
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
    external fun nativeGetBoolean(store: String, key: String, fallback: Boolean): Boolean

    @JvmStatic
    external fun nativeSetBoolean(store: String, key: String, value: Boolean)

    @JvmStatic
    external fun nativeSettingJSON(store: String, key: String): String?

    @JvmStatic
    external fun nativeToolbox(action: String, argument: String?): String?

    @JvmStatic
    external fun nativeFontsJSON(): String

    @JvmStatic
    external fun nativeThemeColorsJSON(themeId: String): String

    @JvmStatic
    external fun nativePrepareAddons()

    @JvmStatic
    fun scheduleRuntimeWork() {
        ReactRuntime.post { runtimePointer -> nativeDrainRuntimeWork(runtimePointer) }
    }

    @JvmStatic
    fun installMetroModuleCaptureBeforeBundle() {
        ReactRuntime.runBeforeBundle { runtimePointer ->
            if (!nativeInstallMetroModuleCapture(runtimePointer)) {
                Logger.error("runtime", "Metro module capture could not be installed")
            }
        }
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
    fun fabricUnmount(handleJSON: String) = NativeFabric.unmount(handleJSON)

    @JvmStatic
    fun fabricIsRunning(handleJSON: String): String = NativeFabric.isRunning(handleJSON)

    @JvmStatic
    fun fabricViewHandle(handleJSON: String): String = NativeFabric.viewHandle(handleJSON)

    @JvmStatic
    fun debugRecordEvaluation(recordJSON: String): Boolean = NativeEvaluations.record(recordJSON)

    @JvmStatic
    fun debugEnvironment(): String = NativeEvaluations.environment()

    @JvmStatic
    fun hooksSetReturnValue(
        tokenJSON: String,
        selfJSON: String,
        argumentsJSON: String,
        valueJSON: String,
    ) = NativeHooks.setReturnValue(tokenJSON, selfJSON, argumentsJSON, valueJSON)

    @JvmStatic
    fun hooksRemoveReturnValue(tokenJSON: String, selfJSON: String, argumentsJSON: String) =
        NativeHooks.removeReturnValue(tokenJSON, selfJSON, argumentsJSON)

    @JvmStatic
    fun hooksClearReturnValues(tokenJSON: String) = NativeHooks.clearReturnValues(tokenJSON)

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
    fun javaSetAssociatedObject(handleJSON: String, keyJSON: String, valueJSON: String) =
        NativeJava.setAssociatedObject(handleJSON, keyJSON, valueJSON)

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
    ): Array<String>? = runCatching {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 15_000
        connection.readTimeout = 30_000
        connection.useCaches = false
        headerKeys.zip(headerValues).forEach { (key, value) -> connection.setRequestProperty(key, value) }

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
            } else if (status != HttpURLConnection.HTTP_NOT_MODIFIED) {
                Logger.error("updater", "Bundle download returned HTTP $status for $url")
                return null
            }
            arrayOf(status.toString(), connection.getHeaderField("etag") ?: "")
        } finally {
            connection.disconnect()
        }
    }.onFailure { Logger.error("updater", "Bundle download failed: $it") }.getOrNull()

    @JvmStatic
    fun devServerURL(): String? {
        if (!Platform.isEmulator()) return null

        val url = "http://$EMULATOR_HOST:$DEV_SERVER_PORT/"
        val serving = runCatching {
            val connection = URL(url + DEV_SERVER_PROBE).openConnection() as HttpURLConnection
            connection.requestMethod = "HEAD"
            connection.connectTimeout = DEV_SERVER_PROBE_TIMEOUT_MS
            connection.readTimeout = DEV_SERVER_PROBE_TIMEOUT_MS
            try {
                connection.responseCode == HttpURLConnection.HTTP_OK
            } finally {
                connection.disconnect()
            }
        }.getOrDefault(false)

        if (!serving) {
            Logger.info("updater", "Emulator: $url is not reachable; using the default update URL.")
            return null
        }

        Logger.info("updater", "Emulator: using $url.")
        return url
    }

    @JvmStatic
    fun availableFonts(): Array<String> = runCatching {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return emptyArray()
        SystemFonts.getAvailableFonts()
            .mapNotNull { it.file?.nameWithoutExtension }
            .distinct()
            .sorted()
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
        Recovery.bundleExecuted = true
        Logger.info("default", "Bundle executed.")
        HotReload.observe()
    }


}
