package app.unbound.android

import android.app.Activity
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.os.Bundle
import android.widget.Toast
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import org.json.JSONObject

object Recovery {
    private const val SHORTCUT_ID = "unbound-recovery"
    private val actionToggle by lazy { NativeBridge.nativeToolbox("recovery-shortcut-action", null).orEmpty() }

    @Volatile
    private var newIntentHooked = false

    fun install(xposed: XposedInterface) {
        val onCreate = Activity::class.java.getDeclaredMethod("onCreate", Bundle::class.java)
        xposed.hook(onCreate)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val result = chain.proceed()
                val activity = chain.thisObject as Activity
                if (isLauncherActivity(activity)) {
                    hookNewIntent(xposed, activity.javaClass)
                    if (activity.intent?.action == actionToggle) toggle(activity)
                    publishShortcut(activity)
                }
                result
            }
    }

    private fun hookNewIntent(xposed: XposedInterface, activityClass: Class<*>) {
        if (newIntentHooked) return
        newIntentHooked = true
        val onNewIntent = generateSequence(activityClass) { it.superclass }
            .firstNotNullOfOrNull { type ->
                runCatching { type.getDeclaredMethod("onNewIntent", Intent::class.java) }.getOrNull()
            } ?: return
        xposed.hook(onNewIntent)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val activity = chain.thisObject as Activity
                val intent = chain.getArg(0) as? Intent
                if (intent?.action == actionToggle && isLauncherActivity(activity)) {
                    activity.intent = intent
                    toggle(activity)
                    publishShortcut(activity)
                    return@intercept null
                }
                chain.proceed()
            }
    }

    fun isEnabled(): Boolean = NativeBridge.preferenceEnabled("recovery")

    private fun isLauncherActivity(activity: Activity): Boolean {
        val launcher = activity.packageManager.getLaunchIntentForPackage(activity.packageName)?.component ?: return false
        val info = runCatching { activity.packageManager.getActivityInfo(launcher, 0) }.getOrNull()
        val target = info?.targetActivity ?: launcher.className
        return target == activity.javaClass.name
    }

    private fun toggle(activity: Activity) {
        activity.intent = Intent(activity.intent).setAction(Intent.ACTION_MAIN)
        val result = runCatching { JSONObject(NativeBridge.nativeToolbox("recovery-shortcut", null).orEmpty()) }
            .getOrDefault(JSONObject())
        Toast.makeText(activity, result.optString("status"), Toast.LENGTH_SHORT).show()
        if (result.optBoolean("restartRequired")) Platform.restartApp()
    }

    private fun publishShortcut(activity: Activity) {
        val manager = activity.getSystemService(ShortcutManager::class.java) ?: return
        val label = NativeBridge.nativePreference("recovery-label", null).orEmpty()
        val intent = Intent(actionToggle).setClassName(activity.packageName, activity.javaClass.name)
        val shortcut = ShortcutInfo.Builder(activity, SHORTCUT_ID)
            .setShortLabel(label)
            .setLongLabel(label)
            .setIntent(intent)
            .build()
        runCatching { manager.addDynamicShortcuts(listOf(shortcut)) }
            .onFailure { Logger.error("default", "Failed to publish the Recovery Mode shortcut", it) }
    }
}
