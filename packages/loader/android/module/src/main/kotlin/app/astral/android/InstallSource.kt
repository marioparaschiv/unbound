package app.astral.android

import android.content.Context
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
    )

    private val PACKAGE_INSTALLERS = setOf(
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
        "com.samsung.android.packageinstaller",
    )

    fun label(installer: String?): String = when {
        installer.isNullOrBlank() || installer in PACKAGE_INSTALLERS -> "Sideloaded"
        else -> STORES[installer] ?: installer
    }

    @Suppress("DEPRECATION")
    private fun installer(context: Context): String? = runCatching {
        val packages = context.packageManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            packages.getInstallSourceInfo(context.packageName).installingPackageName
        } else {
            packages.getInstallerPackageName(context.packageName)
        }
    }.getOrNull()

    fun current(context: Context?): String = label(context?.let(::installer))
}
