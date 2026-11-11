package app.unbound.android

import android.app.Activity
import android.app.Application
import android.content.pm.ApplicationInfo
import android.content.res.AssetManager
import android.os.Build
import android.os.Process
import io.github.libxposed.api.XposedInterface.ExceptionMode
import io.github.libxposed.api.XposedModule
import io.github.libxposed.api.XposedModuleInterface.PackageReadyParam
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.lang.reflect.Method
import java.util.zip.ZipFile

class Unbound : XposedModule() {
    companion object {
        const val DISCORD_PACKAGE = "com.discord"
        private const val NATIVE_LIBRARY = "libunbound.so"
        private const val REACT_INSTANCE = "com.facebook.react.runtime.ReactInstance"
        private const val BUNDLE_LOADER = "com.facebook.react.bridge.JSBundleLoader"
        private const val BOOTSTRAP_DIRECTORY = "assets/js/"
        private const val STARTUP_CACHE = "code_cache/unbound-startup-cache"
        private const val DISCORD_APK_FACTS = "discordAPK"
        private const val BOOTSTRAP_SCRIPTS = "bootstrapScripts"
    }

    override fun onPackageReady(param: PackageReadyParam) {
        if (!param.isFirstPackage) return
        if (param.packageName in LauncherIconHook.LAUNCHERS) {
            LauncherIconHook.install(this)
            return
        }
        if (param.packageName != DISCORD_PACKAGE) return
        // Discord's helper processes have no React runtime; loading there only costs memory and
        // races the main process over Unbound's files.
        val process = Application.getProcessName()
        if (process != DISCORD_PACKAGE) {
            Logger.info(LogCategory.DEFAULT, "Skipping Discord's $process process.")
            return
        }

        runCatching { initialize(param) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to initialize Unbound", it) }
    }

    private fun initialize(param: PackageReadyParam) {
        val moduleInfo = moduleApplicationInfo
        val appInfo = param.applicationInfo
        NativeJava.useClassLoader(param.classLoader)
        installHookBridge()
        runCatching { ReactSurfaces.install(this, param.classLoader) }
            .onFailure { Logger.error(LogCategory.RUNTIME, "Failed to set up React surfaces", it) }
        System.load(nativeLibraryPath(moduleInfo, appInfo))
        Logger.nativeReady = true
        Attestation.start()

        val documents = NativeBridge.nativeDocumentsDirectory(File(appInfo.dataDir, "files").absolutePath)
        NativeBridge.documents = documents
        val cache = StartupCache(File(appInfo.dataDir, STARTUP_CACHE))
        val (bytecodeVersion, packagedIcon) = discordAPKFacts(File(appInfo.sourceDir), cache)
        val lsPatched = Platform.isLSPatched(appInfo, param.classLoader)
        val launcherIcons = !lsPatched
        val platformInfo = Platform.describe(appInfo, Platform.frameworkLabel(frameworkName, frameworkVersion, lsPatched))
        platformInfo.put("appIcons", AndroidAppIcons.describe(moduleInfo, appInfo, packagedIcon, cache))
            .put("launcherIcons", launcherIcons)
        val bootstrapScripts = cache.value(BOOTSTRAP_SCRIPTS, File(moduleInfo.sourceDir)) {
            readBootstrapScripts(moduleInfo.sourceDir)?.toString()
        } ?: "{}"
        cache.save()

        NativeBridge.nativeInitialize(
            documents,
            bootstrapScripts,
            NATIVE_LIBRARY,
            bytecodeVersion,
            platformInfo.toString(),
        )

        Logger.info(LogCategory.DEFAULT, "Hermes bytecode version $bytecodeVersion, documents at $documents")
        DevOverlay.debugBuild = moduleInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        SettingsWatcher.start(documents)
        SettingsWatcher.onChange(::onSettingsChanged)
        hookActivityLifecycle()
        if (BuildConfig.ATTESTATION_ENABLED && !attestationVerified()) return
        val hooked = runCatching { hookBundleLoading(param.classLoader) }
            .onFailure { Logger.error(LogCategory.RUNTIME, "Failed to hook the ReactInstance bundle loader", it) }
        if (hooked.isFailure) {
            StartupAlert.report(NativeBridge.nativeIncompatibleHostMessage())
            return
        }
        Analytics.block(this, param.classLoader)
        runCatching { Telemetry.install(this, param.classLoader, cache, File(appInfo.sourceDir)) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to block Discord's analytics requests", it) }
        runCatching { Fonts.install(this, param.classLoader) }
            .onFailure { Logger.error(LogCategory.FONTS, "Failed to hook React Native fonts", it) }
        runCatching { Themes.install(this, param.classLoader) }
            .onFailure { Logger.error(LogCategory.THEMES, "Failed to apply the theme", it) }
        if (launcherIcons) {
            runCatching { LauncherIconSelection.install(this, param.classLoader) }
                .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to hook Discord's app icon module", it) }
        }
        runCatching { Recovery.install(this) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to install the Recovery Mode shortcut", it) }
        runCatching { Toolbox.install(this) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to install the toolbox gestures", it) }
        runCatching { TextRewrites.install(this) }
            .onFailure { Logger.error(LogCategory.PLUGINS, "Failed to hook text rewrites", it) }
    }

    private fun attestationVerified(): Boolean {
        val attestation = Attestation.current()
        if (attestation.verified) {
            Logger.info(LogCategory.DEFAULT, "Embedded attestation verified, ${attestation.detail}")
            return true
        }
        Logger.error(LogCategory.DEFAULT, "Embedded attestation failed: ${attestation.detail}")
        StartupAlert.report(attestation.warningMessage, attestation.warningTitle)
        return false
    }

    private fun onSettingsChanged() {
        HotReload.sync()
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
                runCatching { NativeBridge.nativeOnForeground() }
                runCatching {
                    StartupAlert.onResumed(activity)
                    Toolbox.onResumed(activity)
                    DevOverlay.onResumed(activity)
                    DevOverlay.showDevelopmentBuildBanner(activity)
                }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to attach the toolbox", it) }
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
                runCatching { NativeBridge.nativeMarkHealthy() }
                result
            }
    }

    private fun hookBundleLoading(classLoader: ClassLoader) {
        val reactInstance = classLoader.loadClass(REACT_INSTANCE)
        val loaders = bundleLoaders(reactInstance, classLoader)
        check(loaders.isNotEmpty()) { "ReactInstance has no bundle loader to hook" }

        for (loader in loaders) {
            hook(loader)
                .setExceptionMode(ExceptionMode.PROTECTIVE)
                .intercept { chain ->
                    Logger.info(
                        LogCategory.RUNTIME,
                        "Loading ReactInstance ${System.identityHashCode(chain.thisObject)} through ${loader.name}",
                    )
                    ReactRuntime.attach(chain.thisObject)
                    NativeBridge.nativeOnLoadJSBundle()
                    NativeBridge.runBundleBeforeDiscord()
                    val result = chain.proceed()
                    Logger.info(
                        LogCategory.RUNTIME,
                        "ReactInstance ${System.identityHashCode(chain.thisObject)} ${loader.name} returned",
                    )
                    result
                }
        }

        Logger.info(LogCategory.DEFAULT, "Hooked ReactInstance.${loaders.joinToString(", ReactInstance.") { it.name }}.")
    }

    private fun bundleLoaders(reactInstance: Class<*>, classLoader: ClassLoader): List<Method> {
        val bundleLoader = runCatching { classLoader.loadClass(BUNDLE_LOADER) }.getOrNull()
        val loadJSBundle = bundleLoader?.let { reactInstance.legacyMethod("loadJSBundle", it) }
        if (loadJSBundle != null) return listOf(loadJSBundle)

        return listOfNotNull(
            runCatching {
                reactInstance.getDeclaredMethod("loadJSBundleFromAssets", AssetManager::class.java, String::class.java)
            }.getOrNull(),
            runCatching { reactInstance.getDeclaredMethod("loadJSBundleFromFile", String::class.java, String::class.java) }.getOrNull(),
        )
    }

    /** Discord's main bundle bytecode version and whether its APK carries Unbound's icon, from one look at the APK. */
    private fun discordAPKFacts(apk: File, cache: StartupCache): Pair<Int, Boolean> {
        cache.get(DISCORD_APK_FACTS, apk)?.split(',')?.takeIf { it.size == 2 }?.let { (version, icon) ->
            version.toIntOrNull()?.let { return it to (icon == "1") }
        }

        val facts = runCatching {
            ZipFile(apk).use { zip ->
                Platform.mainBundleBytecodeVersion(zip) to (zip.getEntry(AndroidAppIcons.MARKER) != null)
            }
        }.getOrDefault(0 to false)
        // An unreadable version is not cached, so the next launch reads the APK again.
        if (facts.first != 0) cache.put(DISCORD_APK_FACTS, apk, "${facts.first},${if (facts.second) 1 else 0}")
        return facts
    }

    private fun nativeLibraryPath(moduleInfo: ApplicationInfo, appInfo: ApplicationInfo): String {
        val installed = moduleInfo.nativeLibraryDir?.let { File(it, NATIVE_LIBRARY) }
        if (installed?.isFile == true) return installed.absolutePath

        val apk = File(moduleInfo.sourceDir)
        val target = File(appInfo.dataDir, "code_cache/unbound/${apk.lastModified()}-${apk.length()}/$NATIVE_LIBRARY")
        if (target.isFile) return target.absolutePath

        target.parentFile?.parentFile?.deleteRecursively()
        target.parentFile?.mkdirs()
        ZipFile(apk).use { zip ->
            val entry = processAbis().firstNotNullOfOrNull { abi -> zip.getEntry("lib/$abi/$NATIVE_LIBRARY") }
                ?: error("Module APK has no $NATIVE_LIBRARY for ${processAbis().joinToString()}")
            // Copied beside the target and renamed into place, so an interrupted copy never leaves a
            // partial library that every later launch would try to load.
            val staging = File(target.parentFile, "$NATIVE_LIBRARY.partial")
            zip.getInputStream(entry).use { input ->
                FileOutputStream(staging).use { output ->
                    input.copyTo(output)
                    output.fd.sync()
                }
            }
            check(entry.size < 0 || staging.length() == entry.size) {
                "Extracted $NATIVE_LIBRARY is ${staging.length()} bytes, expected ${entry.size}"
            }
            check(staging.renameTo(target)) { "Failed to move the extracted $NATIVE_LIBRARY into place" }
        }
        return target.absolutePath
    }

    /** The ABIs Discord's process runs, best first: a 32-bit Discord on a 64-bit phone needs its 32-bit library. */
    private fun processAbis(): List<String> =
        (if (Process.is64Bit()) Build.SUPPORTED_64_BIT_ABIS else Build.SUPPORTED_32_BIT_ABIS).toList()

    /** The module's bootstrap scripts by name, or null when the APK cannot be read, so a failed read is not cached. */
    private fun readBootstrapScripts(apkPath: String): JSONObject? = runCatching {
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
    }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to read the bootstrap scripts from $apkPath", it) }
        .getOrNull()
}
