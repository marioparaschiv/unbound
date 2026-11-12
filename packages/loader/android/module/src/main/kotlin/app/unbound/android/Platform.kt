package app.unbound.android

import android.app.Application
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Process
import org.json.JSONObject
import java.io.File
import java.util.zip.ZipFile

object Platform {
    private const val MAIN_BUNDLE_ENTRY = "assets/index.android.bundle"

    fun application(): Application? = ActivityTracker.application()

    private const val EMULATOR_HOST_ADDRESS = "10.0.2.2"

    fun isEmulator(): Boolean =
        Build.HARDWARE.contains("ranchu") ||
            Build.HARDWARE.contains("goldfish") ||
            Build.FINGERPRINT.contains("generic") ||
            Build.PRODUCT.contains("sdk")

    fun emulatorHostAddress(): String? = if (isEmulator()) EMULATOR_HOST_ADDRESS else null

    private const val RESTART_DELAY_MS = 800L

    fun restartApp() {
        val context = application() ?: return
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        Handler(Looper.getMainLooper()).postDelayed({
            context.startActivity(launch)
            Process.killProcess(Process.myPid())
        }, RESTART_DELAY_MS)
    }

    private val SU_PATHS = listOf(
        "/system/bin/su",
        "/system/xbin/su",
        "/sbin/su",
        "/debug_ramdisk/su",
        "/data/adb/magisk",
        "/data/adb/ksu",
        "/data/adb/ap",
    )

    private const val LSPATCH_LOADER = "org.lsposed.lspatch.loader.LSPApplication"

    private val ROOT_MANAGERS = listOf(
        "/debug_ramdisk/magisk" to "Magisk",
        "/sbin/magisk" to "Magisk",
        "/data/adb/magisk" to "Magisk",
        "/data/adb/ksu" to "KernelSU",
        "/data/adb/ap" to "APatch",
    )

    fun rootManager(exists: (String) -> Boolean = { File(it).exists() }): String =
        ROOT_MANAGERS.firstOrNull { (path, _) -> exists(path) }?.second ?: ""

    fun frameworkLabel(name: String, version: String, patched: Boolean): String =
        listOf(if (patched) "LSPatch" else name, version).filter { it.isNotBlank() }.joinToString(" ")

    fun isLSPatched(appInfo: ApplicationInfo, classLoader: ClassLoader): Boolean =
        appInfo.appComponentFactory?.contains("lspatch", ignoreCase = true) == true ||
            runCatching { Class.forName(LSPATCH_LOADER, false, classLoader) }.isSuccess

    fun describe(appInfo: ApplicationInfo, frameworkName: String): JSONObject = JSONObject()
        .put("deviceModel", DeviceName.current(application()))
        .put("osVersion", Build.VERSION.RELEASE)
        .put("isRooted", SU_PATHS.any { File(it).exists() })
        .put("isSystemApp", appInfo.flags and ApplicationInfo.FLAG_SYSTEM != 0)
        .put("appSource", InstallSource.current(application()))
        .put("framework", frameworkName)
        .put("jailbreak", rootManager())
        .put("isVirtualDevice", isEmulator())
        .put("virtualDeviceHost", emulatorHostAddress() ?: JSONObject.NULL)

    /** Reads the Hermes bytecode version from the header of the main bundle in Discord's open APK; 0 if unreadable. */
    fun mainBundleBytecodeVersion(zip: ZipFile): Int = runCatching {
        val entry = zip.getEntry(MAIN_BUNDLE_ENTRY) ?: return 0
        zip.getInputStream(entry).use { stream ->
            val header = ByteArray(12)
            var read = 0
            while (read < header.size) {
                val count = stream.read(header, read, header.size - read)
                if (count < 0) return 0
                read += count
            }
            NativeBridge.nativeHermesBytecodeVersion(header)
        }
    }.getOrDefault(0)
}
