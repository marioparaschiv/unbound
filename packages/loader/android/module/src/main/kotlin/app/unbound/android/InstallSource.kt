package app.unbound.android

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

object InstallSource {
    private val STORES = mapOf(
        "com.android.vending" to "Google Play",
        "com.aurora.store" to "Aurora Store",
        "org.fdroid.fdroid" to "F-Droid",
        "com.sec.android.app.samsungapps" to "Galaxy Store",
        "com.amazon.venezia" to "Amazon Appstore",
        "com.huawei.appmarket" to "AppGallery",
        "com.xiaomi.market" to "Xiaomi GetApps",
        "com.android.shell" to "ADB",
        "dev.imranr.obtainium" to "Obtainium",
        "dev.imranr.obtainium.fdroid" to "Obtainium",
        "com.looker.droidify" to "Droid-ify",
        "com.machiav3lli.fdroid" to "Neo Store",
        "com.aefyr.sai" to "SAI",
        "com.aefyr.sai.fdroid" to "SAI",
        "io.github.muntashirakon.AppManager" to "App Manager",
        "com.apkmirror.helper.prod" to "APKMirror Installer",
        "app.accrescent.client" to "Accrescent",
        "com.uptodown" to "Uptodown",
        "com.apkpure.aegon" to "APKPure",
        "com.rosan.installer.x" to "InstallerX",
        "com.rosan.installer.x.revived" to "InstallerX",
        "com.taptap" to "TapTap",
        "com.taptap.global" to "TapTap",
        "com.qooapp.qoohelper" to "QooApp",
        "com.heytap.market" to "OPPO App Market",
        "com.oppo.market" to "OPPO App Market",
        "com.oneplus.market" to "OnePlus Store",
        "com.bbk.appstore" to "vivo App Store",
        "com.hihonor.appmarket" to "Honor App Market",
    )

    private val PACKAGE_INSTALLERS = setOf(
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
        "com.samsung.android.packageinstaller",
    )

    private const val SYSTEM = "android"

    private data class Installers(val installing: String?, val initiating: String?)

    private fun viaSystem(packageName: String?): Boolean =
        packageName.isNullOrBlank() || packageName in PACKAGE_INSTALLERS || packageName == SYSTEM

    private fun name(packageName: String): String = STORES[packageName] ?: packageName

    fun label(installing: String?, initiating: String? = null): String = when {
        !viaSystem(installing) -> name(installing!!)
        !viaSystem(initiating) -> "Sideloaded via ${name(initiating!!)}"
        else -> "Sideloaded"
    }

    private fun systemPackageManager(): PackageManager? = runCatching {
        val threadClass = Class.forName("android.app.ActivityThread")
        val thread = threadClass.getMethod("currentActivityThread").invoke(null)
        (threadClass.getMethod("getSystemContext").invoke(thread) as? Context)?.packageManager
    }.getOrNull()

    @Suppress("DEPRECATION")
    private fun installers(packages: PackageManager, packageName: String): Installers = runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val info = packages.getInstallSourceInfo(packageName)
            Installers(info.installingPackageName, info.initiatingPackageName)
        } else {
            Installers(packages.getInstallerPackageName(packageName), null)
        }
    }.getOrDefault(Installers(null, null))

    fun current(context: Context?, packageName: String): String {
        val packages = context?.packageManager ?: systemPackageManager() ?: return label(null)
        val (installing, initiating) = installers(packages, packageName)
        return label(installing, initiating)
    }
}
