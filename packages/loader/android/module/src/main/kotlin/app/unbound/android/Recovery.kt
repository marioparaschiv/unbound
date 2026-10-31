package app.unbound.android

import android.app.Activity
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.Icon
import android.os.Bundle
import android.widget.Toast
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import org.json.JSONObject
import kotlin.math.roundToInt

object Recovery {
    private const val SHORTCUT_ID = "unbound-recovery"
    private const val ICON_SIZE_DP = 108
    private const val GLYPH_INSET = 0.3f
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
                    activate(activity, activity.intent)
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
                if (isLauncherActivity(activity) && activate(activity, intent)) {
                    publishShortcut(activity)
                    return@intercept null
                }
                chain.proceed()
            }
    }

    private fun isLauncherActivity(activity: Activity): Boolean {
        val launcher = activity.packageManager.getLaunchIntentForPackage(activity.packageName)?.component ?: return false
        val info = runCatching { activity.packageManager.getActivityInfo(launcher, 0) }.getOrNull()
        val target = info?.targetActivity ?: launcher.className
        return target == activity.javaClass.name
    }

    private fun activate(activity: Activity, intent: Intent?): Boolean {
        val action = intent?.action ?: return false
        val result = runCatching { JSONObject(NativeBridge.nativeToolbox("recovery-shortcut-activate", action).orEmpty()) }
            .getOrDefault(JSONObject())
        if (!result.optBoolean("handled")) return false

        activity.intent = Intent(intent).setAction(Intent.ACTION_MAIN)
        Toast.makeText(activity, result.optString("status"), Toast.LENGTH_SHORT).show()
        if (result.optBoolean("restartRequired")) Platform.restartApp()
        return true
    }

    private fun shortcutIcon(activity: Activity): Icon? = runCatching {
        val size = (ICON_SIZE_DP * activity.resources.displayMetrics.density).roundToInt()
        val inset = (size * GLYPH_INSET).roundToInt()
        val glyph = activity.getDrawable(android.R.drawable.ic_menu_revert)?.mutate() ?: return null
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.rgb(88, 101, 242))
        glyph.setTint(Color.WHITE)
        glyph.setBounds(inset, inset, size - inset, size - inset)
        glyph.draw(canvas)
        Icon.createWithAdaptiveBitmap(bitmap)
    }.getOrNull()

    private fun publishShortcut(activity: Activity) {
        val manager = activity.getSystemService(ShortcutManager::class.java) ?: return
        val label = NativeBridge.nativePreference("recovery-label", null).orEmpty()
        val intent = Intent(actionToggle).setClassName(activity.packageName, activity.javaClass.name)
        val builder = ShortcutInfo.Builder(activity, SHORTCUT_ID)
            .setShortLabel(label)
            .setLongLabel(label)
            .setIntent(intent)
        shortcutIcon(activity)?.let(builder::setIcon)
        val shortcut = builder.build()
        runCatching { manager.addDynamicShortcuts(listOf(shortcut)) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to publish the Recovery Mode shortcut", it) }
    }
}
