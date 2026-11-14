package app.unbound.android

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager

internal object LauncherPackages {
    val HOOKED = setOf(
        "com.google.android.apps.nexuslauncher",
        "com.android.launcher3",
        "com.miui.home",
        "com.mi.android.globallauncher",
        "com.sec.android.app.launcher",
        "com.oppo.launcher",
        "com.android.launcher",
        "net.oneplus.launcher",
        "com.huawei.android.launcher",
        "com.hihonor.android.launcher",
        "com.nothing.launcher",
        "com.motorola.launcher3",
        "com.bbk.launcher2",
        "com.asus.launcher",
        "com.sonymobile.home",
        "com.transsion.hilauncher",
        "app.lawnchair",
        "com.teslacoilsw.launcher",
    )

    fun defaultLauncher(context: Context): String? {
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val resolved = runCatching {
            context.packageManager.resolveActivity(home, PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()))
        }.getOrNull()
        return resolved?.activityInfo?.packageName?.takeIf { it != "android" }
    }

    fun drawsCustomIcons(context: Context): Boolean = defaultLauncher(context)?.let { it in HOOKED } ?: true
}
