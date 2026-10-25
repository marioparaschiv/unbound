package app.unbound.android

import android.app.Activity
import android.content.pm.ApplicationInfo
import android.os.Build
import io.github.libxposed.api.XposedInterface.ExceptionMode
import io.github.libxposed.api.XposedModule
import io.github.libxposed.api.XposedModuleInterface.PackageReadyParam
import org.json.JSONObject
import java.io.File
import java.util.zip.ZipFile

class Unbound : XposedModule() {
    companion object {
        const val DISCORD_PACKAGE = "com.discord"
        private const val NATIVE_LIBRARY = "libunbound.so"
        private const val REACT_INSTANCE = "com.facebook.react.runtime.ReactInstance"
        private const val BUNDLE_LOADER = "com.facebook.react.bridge.JSBundleLoader"
        private const val BOOTSTRAP_DIRECTORY = "assets/js/"
    }

    override fun onPackageReady(param: PackageReadyParam) {
        if (param.packageName != DISCORD_PACKAGE || !param.isFirstPackage) return

        runCatching { initialize(param) }
            .onFailure { Logger.error("default", "Failed to initialize Unbound", it) }
    }

    private fun initialize(param: PackageReadyParam) {
        val moduleInfo = moduleApplicationInfo
        val appInfo = param.applicationInfo
        NativeJava.useClassLoader(param.classLoader)
        installHookBridge()
        ReactSurfaces.install(param.classLoader)
        System.load(nativeLibraryPath(moduleInfo, appInfo))

        val documents = File(File(appInfo.dataDir, "files"), NativeBridge.nativeDocumentsName()).absolutePath
        NativeBridge.documents = documents
        val bytecodeVersion = Platform.mainBundleBytecodeVersion(appInfo.sourceDir)

        NativeBridge.nativeInitialize(
            documents,
            readBootstrapScripts(moduleInfo.sourceDir).toString(),
            NATIVE_LIBRARY,
            bytecodeVersion,
            Platform.describe(appInfo, frameworkName).toString(),
        )

        Logger.info("default", "Hermes bytecode version $bytecodeVersion, documents at $documents")
        DevOverlay.debugBuild = moduleInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        SettingsWatcher.start(documents)
        SettingsWatcher.onChange(::onSettingsChanged)
        hookActivityLifecycle()
        hookBundleLoading(param.classLoader)
        Analytics.block(this, param.classLoader)
        runCatching { Fonts.install(this, param.classLoader) }
            .onFailure { Logger.error("fonts", "Failed to hook React Native fonts", it) }
        runCatching { Themes.install(this, param.classLoader) }
            .onFailure { Logger.error("themes", "Failed to apply the theme", it) }
        runCatching { Recovery.install(this) }
            .onFailure { Logger.error("default", "Failed to install the Recovery Mode shortcut", it) }
        runCatching { Toolbox.install(this) }
            .onFailure { Logger.error("default", "Failed to install the toolbox gestures", it) }
        runCatching { ChatUI.install(this, param.classLoader) }
            .onFailure { Logger.error("chatui", "Failed to hook the chat UI", it) }
        runCatching { TextRewrites.install(this) }
            .onFailure { Logger.error("plugins", "Failed to hook text rewrites", it) }
    }

    private fun onSettingsChanged() {
        HotReload.sync()
        ChatUI.reload()
        ActivityTracker.currentActivity()?.let(DevOverlay::onResumed)
    }

    private fun installHookBridge() {
        NativeHooks.useInstaller(object : NativeHooks.Installer {
            override fun install(
                method: java.lang.reflect.Executable,
                hook: NativeHooks.Hook,
            ): NativeHooks.Removable {
                val unhook = hook(method)
                    .setExceptionMode(ExceptionMode.PROTECTIVE)
                    .intercept { chain ->
                        hook.intercept(object : NativeHooks.Chain {
                            override fun target(): Any? = chain.thisObject
                            override fun argument(index: Int): Any? = chain.getArg(index)
                            override fun argumentCount(): Int = chain.args.size
                            override fun proceed(): Any? = chain.proceed()
                        })
                    }

                return object : NativeHooks.Removable {
                    override fun remove() = unhook.unhook()
                }
            }
        })

        NativeHooks.useDispatcher(object : NativeHooks.Dispatcher {
            override fun dispatch(token: String, payloadJSON: String) {
                NativeBridge.nativeDispatchHookEvent(token, payloadJSON)
            }
        })
    }

    private fun hookActivityLifecycle() {
        val onResume = Activity::class.java.getDeclaredMethod("onResume")
        hook(onResume)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val result = chain.proceed()
                val activity = chain.thisObject as Activity
                ActivityTracker.onActivityResumed(activity)
                runCatching {
                    Toolbox.onResumed(activity)
                    DevOverlay.onResumed(activity)
                }.onFailure { Logger.error("default", "Failed to attach the toolbox", it) }
                result
            }

        val onPause = Activity::class.java.getDeclaredMethod("onPause")
        hook(onPause)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val result = chain.proceed()
                val activity = chain.thisObject as Activity
                ActivityTracker.onActivityPaused(activity)
                runCatching { Toolbox.onPaused(activity) }
                result
            }
    }

    private fun hookBundleLoading(classLoader: ClassLoader) {
        val reactInstance = classLoader.loadClass(REACT_INSTANCE)
        val bundleLoader = classLoader.loadClass(BUNDLE_LOADER)
        val loadJSBundle = reactInstance.getDeclaredMethod("loadJSBundle", bundleLoader)

        hook(loadJSBundle)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                Logger.info(
                    "runtime",
                    "Loading ReactInstance ${System.identityHashCode(chain.thisObject)}",
                )
                ReactRuntime.attach(chain.thisObject)
                NativeBridge.nativeOnLoadJSBundle()
                NativeBridge.installMetroModuleCaptureBeforeBundle()
                val result = chain.proceed()
                NativeBridge.nativeOnJSBundleLoaded()
                Logger.info(
                    "runtime",
                    "ReactInstance ${System.identityHashCode(chain.thisObject)} loadJSBundle returned",
                )
                result
            }

        Logger.info("default", "Hooked ReactInstance.loadJSBundle.")
    }

    private fun nativeLibraryPath(moduleInfo: ApplicationInfo, appInfo: ApplicationInfo): String {
        val installed = moduleInfo.nativeLibraryDir?.let { File(it, NATIVE_LIBRARY) }
        if (installed?.isFile == true) return installed.absolutePath

        val apk = File(moduleInfo.sourceDir)
        val abi = Build.SUPPORTED_ABIS.first()
        val target = File(appInfo.dataDir, "code_cache/unbound/${apk.lastModified()}-${apk.length()}/$NATIVE_LIBRARY")
        if (target.isFile) return target.absolutePath

        target.parentFile?.parentFile?.deleteRecursively()
        target.parentFile?.mkdirs()
        ZipFile(apk).use { zip ->
            val entry = zip.getEntry("lib/$abi/$NATIVE_LIBRARY")
                ?: error("Module APK has no $NATIVE_LIBRARY for $abi")
            zip.getInputStream(entry).use { input -> target.outputStream().use { input.copyTo(it) } }
        }
        return target.absolutePath
    }

    private fun readBootstrapScripts(apkPath: String): JSONObject = runCatching {
        ZipFile(apkPath).use { zip ->
            val scripts = JSONObject()
            zip.entries().asSequence()
                .filter { it.name.startsWith(BOOTSTRAP_DIRECTORY) && it.name.endsWith(".js") }
                .forEach { entry ->
                    val name = entry.name.removePrefix(BOOTSTRAP_DIRECTORY).removeSuffix(".js")
                    scripts.put(name, zip.getInputStream(entry).bufferedReader().use { it.readText() })
                }
            scripts
        }
    }.getOrDefault(JSONObject())
}
