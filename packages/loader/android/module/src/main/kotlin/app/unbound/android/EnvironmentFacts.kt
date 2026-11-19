package app.unbound.android

import android.app.ActivityManager
import android.app.UiModeManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.os.UserManager
import android.provider.Settings
import android.text.TextUtils
import android.view.View
import android.view.WindowManager
import android.system.Os
import android.system.OsConstants
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.DecimalFormatSymbols
import java.util.Locale
import java.security.MessageDigest
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate

object EnvironmentFacts {
    private const val DISCORD_CERTIFICATE = "3c39d23cf9367849a5c699395647fe0e5bfea5a1f1f40d8c717ddc70f8bfa113"
    private const val LSPATCH_CONFIG = "lspatch/config.json"
    private const val NPATCH_CONFIG = "npatch/config.json"
    private const val SELINUX_ENFORCE = "/sys/fs/selinux/enforce"
    private const val USERS_PER_RANGE = 100_000
    private val ABI_SPLITS = setOf("config.arm64_v8a", "config.armeabi_v7a", "config.x86_64", "config.x86")
    private val ROM_PROPERTIES = listOf(
        "ro.lineage.version" to "LineageOS",
        "ro.crdroid.version" to "crDroid",
        "ro.evolution.version" to "Evolution X",
        "ro.pixelexperience.version" to "PixelExperience",
        "ro.grapheneos.version" to "GrapheneOS",
        "ro.calyxos.version" to "CalyxOS",
        "ro.aospa.version" to "Paranoid Android",
        "ro.arrow.version" to "ArrowOS",
        "ro.derp.version" to "DerpFest",
        "ro.rising.version" to "RisingOS",
        "ro.matrixx.version" to "Project Matrixx",
        "ro.voltage.version" to "VoltageOS",
        "ro.modversion" to "",
    )

    private val EMULATOR_FILES = listOf(
        "/data/.bluestacks.prop" to "BlueStacks",
        "/system/bin/bstfolderd" to "BlueStacks",
        "/system/lib/egl/libGLES_bst.so" to "BlueStacks",
        "/system/bin/nox-prop" to "Nox",
        "/system/bin/ldinit" to "LDPlayer",
        "/dev/socket/genyd" to "Genymotion",
        "/system/bin/microvirt-prop" to "MEmu",
        "/system/lib/libmicrovirt.so" to "MEmu",
        "/system/bin/nemuVM-prop" to "MuMu",
        "/system/lib/libnemuVMprop.so" to "MuMu",
        "/system/bin/androVM-prop" to "Genymotion",
    )
    private val SKIN_PROPERTIES = listOf<Pair<String, (String) -> String>>(
        "ro.mi.os.version.name" to { "HyperOS ${it.removePrefix("OS")}" },
        "ro.miui.ui.version.name" to { "MIUI ${it.removePrefix("V")}" },
        "ro.build.version.oneui" to { oneUI(it) },
        "ro.build.version.oplusrom" to { "ColorOS ${it.removePrefix("V")}" },
        "ro.build.version.opporom" to { "ColorOS ${it.removePrefix("V")}" },
        "hw_sc.build.platform.version" to { "HarmonyOS $it" },
        "ro.build.version.emui" to { "EMUI ${it.substringAfter('_')}" },
        "ro.vivo.os.version" to { "${property("ro.vivo.os.name") ?: "Funtouch OS"} $it" },
    )
    private const val CHROME_OS_FEATURE = "org.chromium.arc"
    private const val PLAY_GAMES_PC_FEATURE = "com.google.android.play.feature.HPE_EXPERIENCE"
    private const val WAYDROID_PROPERTY = "waydroid.tools_version"
    private const val ONE_UI_MAJOR = 10_000
    private const val ONE_UI_MINOR = 100
    private const val NATIVE_BRIDGE_PROPERTY = "ro.dalvik.vm.native.bridge"
    private const val ADOPTABLE_STORAGE = "/mnt/expand/"
    private const val UNFOLDED_WIDTH_DP = 600
    private const val FONT_WEIGHT_ADJUSTMENT = "font_weight_adjustment"
    private const val HARMONY_BUILD_CLASS = "com.huawei.system.BuildEx"
    private const val HARMONY_BRAND = "harmony"

    @JvmStatic
    fun collect(): String = runCatching {
        val context = Platform.application() ?: return "{}"
        JSONObject().put("install", install(context)).put("device", device(context)).toString()
    }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to read the environment facts", it) }.getOrDefault("{}")

    private fun install(context: Context): JSONObject {
        val certificate = signingCertificate(context)
        val signer = certificate?.let { digest(it.encoded) }
        return JSONObject()
            .put("signer", signer ?: "")
            .put("signerSubject", certificate?.let { subjectOf(it) } ?: "")
            .put("discordSigned", signer == DISCORD_CERTIFICATE)
            .put("patch", patchMode(context))
            .put("splits", context.applicationInfo.splitNames?.size ?: 0)
            .put("missingSplits", JSONArray(missingSplits(context)))
            .put("profile", profile(context))
    }

    private fun device(context: Context): JSONObject = JSONObject()
        .put("selinux", selinuxEnforcing() ?: JSONObject.NULL)
        .put("verifiedBoot", property("ro.boot.verifiedbootstate") ?: "")
        .put("buildTags", Build.TAGS ?: "")
        .put("rom", customROM())
        .put("pageSize", Os.sysconf(OsConstants._SC_PAGESIZE))
        .put("webView", webView(context))
        .put("host", hostPlatform(context))
        .put("skin", vendorSkin())
        .put("background", background(context))
        .put("abiBridge", property(NATIVE_BRIDGE_PROPERTY) ?: "")
        .put("lowRam", context.getSystemService(ActivityManager::class.java)?.isLowRamDevice == true)
        .put("harmony", isHarmonyOS())
        .put("adoptable", context.applicationInfo.sourceDir?.startsWith(ADOPTABLE_STORAGE) == true)
        .put("refreshRate", refreshRate(context))
        .put("boldText", isBoldText(context))
        .put("formFactor", formFactor(context))
        .put("duplicateCopy", SingleCopy.duplicate())
        .put("locale", localeFacts())

    private fun formFactor(context: Context): String = runCatching {
        when (context.getSystemService(UiModeManager::class.java)?.currentModeType) {
            Configuration.UI_MODE_TYPE_TELEVISION -> "Android TV"
            Configuration.UI_MODE_TYPE_WATCH -> "Wear OS"
            Configuration.UI_MODE_TYPE_CAR -> "Android Automotive"
            else -> foldState(context)
        }
    }.getOrDefault("")

    private fun foldState(context: Context): String {
        if (!context.packageManager.hasSystemFeature(PackageManager.FEATURE_SENSOR_HINGE_ANGLE)) return ""

        val unfolded = context.resources.configuration.smallestScreenWidthDp >= UNFOLDED_WIDTH_DP

        return if (unfolded) "foldable, unfolded" else "foldable, folded"
    }

    private fun isHarmonyOS(): Boolean = runCatching {
        Class.forName(HARMONY_BUILD_CLASS).getMethod("getOsBrand").invoke(null) == HARMONY_BRAND
    }.getOrDefault(false)

    @Suppress("DEPRECATION")
    private fun refreshRate(context: Context): Int = runCatching {
        context.getSystemService(WindowManager::class.java)?.defaultDisplay?.refreshRate?.toInt() ?: 0
    }.getOrDefault(0)

    private fun isBoldText(context: Context): Boolean = runCatching {
        Build.VERSION.SDK_INT >= 31 && Settings.Secure.getInt(context.contentResolver, FONT_WEIGHT_ADJUSTMENT, 0) > 0
    }.getOrDefault(false)

    private fun localeFacts(): JSONObject = runCatching {
        val locale = Locale.getDefault()
        JSONObject()
            .put("calendar", android.icu.util.Calendar.getInstance(locale).type)
            .put("nonLatinDigits", DecimalFormatSymbols.getInstance(locale).zeroDigit != '0')
            .put("rtl", TextUtils.getLayoutDirectionFromLocale(locale) == View.LAYOUT_DIRECTION_RTL)
    }.getOrDefault(JSONObject())

    private fun signingCertificate(context: Context): X509Certificate? = runCatching {
        val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        val signature = info.signingInfo?.apkContentsSigners?.firstOrNull() ?: return null
        CertificateFactory.getInstance("X.509").generateCertificate(signature.toByteArray().inputStream()) as X509Certificate
    }.getOrNull()

    private fun digest(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    private fun subjectOf(certificate: X509Certificate): String {
        val names = certificate.subjectX500Principal.name.split(',').map { it.trim() }
        return names.firstOrNull { it.startsWith("O=") } ?: names.firstOrNull { it.startsWith("CN=") } ?: ""
    }

    private fun patchMode(context: Context): String {
        val (name, config) = listOf("NPatch" to NPATCH_CONFIG, "LSPatch" to LSPATCH_CONFIG).firstNotNullOfOrNull { (name, path) ->
            runCatching { context.assets.open(path).bufferedReader().use { name to it.readText() } }.getOrNull()
        } ?: return Platform.patcher(context.applicationInfo, context.classLoader).ifEmpty { "Xposed module" }
        val useManager = runCatching { JSONObject(config).optBoolean("useManager", false) }.getOrDefault(false)
        return if (useManager) "$name local" else "$name integrated"
    }

    private fun hostPlatform(context: Context): String {
        val packages = context.packageManager
        return when {
            packages.hasSystemFeature(PLAY_GAMES_PC_FEATURE) -> "Play Games PC"
            packages.hasSystemFeature(CHROME_OS_FEATURE) -> "ChromeOS"
            property(WAYDROID_PROPERTY) != null -> "Waydroid"
            else -> EMULATOR_FILES.firstOrNull { (path, _) -> File(path).exists() }?.second
                ?: virtualHost(context)
                ?: ""
        }
    }

    private fun virtualHost(context: Context): String? = runCatching {
        val packages = context.packageManager
        val owner = packages.getNameForUid(Process.myUid())?.substringBefore(':')
        val dataDir = context.applicationInfo.dataDir.orEmpty()
        when {
            owner != null && owner != context.packageName -> "inside ${labelOf(packages, owner)}"
            dataDir.isNotEmpty() && !isStandardDataDir(dataDir) -> "virtual storage"
            else -> null
        }
    }.getOrNull()

    private fun labelOf(packages: PackageManager, name: String): String = runCatching {
        packages.getApplicationLabel(packages.getApplicationInfo(name, 0)).toString()
    }.getOrNull()?.takeIf { it.isNotBlank() } ?: name

    internal fun isStandardDataDir(path: String): Boolean =
        path.startsWith("/data/user/") || path.startsWith("/data/data/") || path.startsWith("/data/user_de/") ||
            path.startsWith("/mnt/expand/")

    private fun oneUI(version: String): String {
        val code = version.toIntOrNull() ?: return "One UI $version"
        return "One UI ${code / ONE_UI_MAJOR}.${code % ONE_UI_MAJOR / ONE_UI_MINOR}"
    }

    private fun vendorSkin(): String =
        SKIN_PROPERTIES.firstNotNullOfOrNull { (key, label) -> property(key)?.let(label) } ?: ""

    private fun background(context: Context): JSONObject = runCatching {
        val power = context.getSystemService(PowerManager::class.java)
        val activity = context.getSystemService(ActivityManager::class.java)
        val usage = context.getSystemService(UsageStatsManager::class.java)
        JSONObject()
            .put("optimized", power?.isIgnoringBatteryOptimizations(context.packageName) == false)
            .put("restricted", Build.VERSION.SDK_INT >= 28 && activity?.isBackgroundRestricted == true)
            .put("bucket", if (Build.VERSION.SDK_INT >= 28) usage?.appStandbyBucket ?: 0 else 0)
    }.getOrDefault(JSONObject())

    private fun missingSplits(context: Context): List<String> {
        val splits = context.applicationInfo.splitNames?.toList() ?: return emptyList()
        val abi = Build.SUPPORTED_ABIS.firstOrNull() ?: return emptyList()
        if (splits.isEmpty() || splits.any { it in ABI_SPLITS }) return emptyList()
        return listOf("config." + abi.replace('-', '_'))
    }

    private fun profile(context: Context): String {
        val users = context.getSystemService(UserManager::class.java)
        val user = Process.myUid() / USERS_PER_RANGE
        return when {
            isPrivateProfile(users) -> "Private Space"
            runCatching { Build.VERSION.SDK_INT >= 30 && users?.isManagedProfile == true }.getOrDefault(false) -> "work profile"
            user != 0 -> "clone (user $user)"
            else -> ""
        }
    }

    private fun isPrivateProfile(users: UserManager?): Boolean = runCatching {
        users != null && UserManager::class.java.getMethod("isPrivateProfile").invoke(users) == true
    }.getOrDefault(false)

    private fun selinuxEnforcing(): Boolean? =
        runCatching { File(SELINUX_ENFORCE).readText().trim() == "1" }.getOrNull()
            ?: runCatching {
                Class.forName("android.os.SELinux").getMethod("isSELinuxEnforced").invoke(null) as? Boolean
            }.getOrNull()

    private fun property(key: String): String? = runCatching {
        Class.forName("android.os.SystemProperties").getMethod("get", String::class.java).invoke(null, key) as? String
    }.getOrNull()?.takeIf { it.isNotBlank() }

    private fun customROM(): String = ROM_PROPERTIES.firstNotNullOfOrNull { (key, name) ->
        property(key)?.let { version -> listOf(name, version).filter { it.isNotBlank() }.joinToString(" ") }
    } ?: ""

    private fun webView(context: Context): String = runCatching {
        val webView = WebView.getCurrentWebViewPackage() ?: return ""
        val major = webView.versionName?.substringBefore('.') ?: ""
        listOf(webView.packageName, major).filter { it.isNotBlank() }.joinToString(" ")
    }.getOrDefault("")
}
