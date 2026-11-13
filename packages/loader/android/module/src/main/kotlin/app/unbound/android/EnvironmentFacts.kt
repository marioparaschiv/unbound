package app.unbound.android

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.os.UserManager
import android.system.Os
import android.system.OsConstants
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate

object EnvironmentFacts {
    private const val DISCORD_CERTIFICATE = "3c39d23cf9367849a5c699395647fe0e5bfea5a1f1f40d8c717ddc70f8bfa113"
    private const val LSPATCH_CONFIG = "lspatch/config.json"
    private const val SELINUX_ENFORCE = "/sys/fs/selinux/enforce"
    private const val USERS_PER_RANGE = 100_000
    private val ABI_SPLITS = setOf("config.arm64_v8a", "config.armeabi_v7a", "config.x86_64", "config.x86")
    private val ROM_PROPERTIES = listOf(
        "ro.lineage.version" to "LineageOS",
        "ro.crdroid.version" to "crDroid",
        "ro.evolution.version" to "Evolution X",
        "ro.pixelexperience.version" to "PixelExperience",
        "ro.grapheneos.version" to "GrapheneOS",
        "ro.modversion" to "",
    )

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
        val config = runCatching { context.assets.open(LSPATCH_CONFIG).bufferedReader().use { it.readText() } }.getOrNull()
            ?: return if (Platform.isLSPatched(context.applicationInfo, context.classLoader)) "LSPatch" else "Xposed module"
        val useManager = runCatching { JSONObject(config).optBoolean("useManager", false) }.getOrDefault(false)
        return if (useManager) "LSPatch local" else "LSPatch integrated"
    }

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
