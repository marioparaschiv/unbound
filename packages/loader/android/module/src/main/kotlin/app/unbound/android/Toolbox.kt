package app.unbound.android

import android.app.Activity
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.util.TypedValue
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import org.json.JSONObject
import java.io.File
import kotlin.math.sqrt

object Toolbox {
    private const val SHAKE_KEY = "toolbox.shake"
    private const val THREE_FINGER_KEY = "toolbox.three-finger"
    private const val LONG_PRESS_MS = 800L
    private const val SHAKE_GRAVITY = 2.6f
    private const val SHAKE_WINDOW_MS = 900L
    private const val SHAKE_COOLDOWN_MS = 1_500L
    private const val ADDON_KINDS = "Plugins,Themes,Icons,Fonts"

    private val main = Handler(Looper.getMainLooper())
    private var pressRunnable: Runnable? = null
    private var shakeStart = 0L
    private var lastShake = 0L
    private var shown: AlertDialog? = null
    private var sensorListener: SensorEventListener? = null

    fun install(xposed: XposedInterface) {
        val dispatch = Activity::class.java.getDeclaredMethod("dispatchTouchEvent", MotionEvent::class.java)
        xposed.hook(dispatch)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                trackPress(chain.thisObject as Activity, chain.getArg(0) as MotionEvent)
                chain.proceed()
            }
    }

    fun onResumed(activity: Activity) {
        if (sensorListener != null) return

        val sensors = activity.getSystemService(SensorManager::class.java) ?: return
        val accelerometer = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return
        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) = trackShake(event)
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
        }

        sensors.registerListener(listener, accelerometer, SensorManager.SENSOR_DELAY_UI)
        sensorListener = listener
    }

    fun onPaused(activity: Activity) {
        val listener = sensorListener ?: return

        activity.getSystemService(SensorManager::class.java)?.unregisterListener(listener)
        sensorListener = null
    }

    fun show() {
        main.post {
            val activity = ActivityTracker.currentActivity() ?: return@post
            if (shown?.isShowing == true || activity.isFinishing) return@post

            shown = AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                .setTitle("Unbound Toolbox")
                .setView(menu(activity))
                .setNegativeButton("Close", null)
                .show()
        }
    }

    private fun trackPress(activity: Activity, event: MotionEvent) {
        when (event.actionMasked) {
            MotionEvent.ACTION_POINTER_DOWN -> if (event.pointerCount == 3 && enabled(THREE_FINGER_KEY)) {
                cancelPress()
                val runnable = Runnable {
                    pressRunnable = null
                    confirmHaptic(activity)
                    show()
                }
                pressRunnable = runnable
                main.postDelayed(runnable, LONG_PRESS_MS)
            }
            MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> cancelPress()
        }
    }

    private fun cancelPress() {
        pressRunnable?.let(main::removeCallbacks)
        pressRunnable = null
    }

    private fun trackShake(event: SensorEvent) {
        if (!enabled(SHAKE_KEY)) return

        val (x, y, z) = Triple(event.values[0], event.values[1], event.values[2])
        val force = sqrt(x * x + y * y + z * z) / SensorManager.GRAVITY_EARTH
        val now = System.currentTimeMillis()

        if (force < SHAKE_GRAVITY || now - lastShake < SHAKE_COOLDOWN_MS) return

        if (shakeStart == 0L || now - shakeStart > SHAKE_WINDOW_MS) {
            shakeStart = now
            return
        }

        shakeStart = 0L
        lastShake = now
        ActivityTracker.currentActivity()?.let(::confirmHaptic)
        show()
    }

    private fun confirmHaptic(activity: Activity) {
        activity.window?.decorView?.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
    }

    private fun enabled(key: String): Boolean = NativeBridge.nativeGetBoolean("unbound", key, true)

    private fun menu(activity: Activity): View {
        val list = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(activity, 8), dp(activity, 4), dp(activity, 8), dp(activity, 4))
        }

        list.addView(header(activity, "Settings"))
        list.addView(toggle(activity, "Shake to open", SHAKE_KEY, THREE_FINGER_KEY))
        list.addView(toggle(activity, "Three-finger press to open", THREE_FINGER_KEY, SHAKE_KEY))

        list.addView(header(activity, "Bundle"))
        list.addView(action(activity, "Refetch Bundle") { refetchBundle(activity) })
        list.addView(action(activity, "Delete Bundle") {
            confirm(activity, "Delete Bundle") { run("delete-bundle") }
        })
        list.addView(action(activity, "Load Custom Bundle") { loadCustomBundle(activity) })

        list.addView(header(activity, "Addons"))
        for (kind in ADDON_KINDS.split(",")) {
            list.addView(action(activity, "Wipe $kind") {
                confirm(activity, "Wipe $kind") { run("wipe", kind) }
            })
        }

        list.addView(header(activity, "Utilities"))
        val recovery = NativeBridge.nativeGetBoolean("unbound", "recovery", false)
        list.addView(action(activity, if (recovery) "Disable Safe Mode" else "Enable Safe Mode") {
            run("toggle-recovery")
        })
        list.addView(action(activity, "Factory Reset") {
            confirm(activity, "Factory Reset") { run("factory-reset") }
        })
        list.addView(action(activity, "Copy App Folder Path") { copyFolderPath(activity) })
        list.addView(action(activity, "Open GitHub Issue") { openIssue(activity) })

        return ScrollView(activity).apply { addView(list) }
    }

    private fun header(context: Context, title: String) = TextView(context).apply {
        text = title.uppercase()
        setTextColor(Color.rgb(150, 155, 165))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        typeface = Typeface.DEFAULT_BOLD
        setPadding(dp(context, 12), dp(context, 16), dp(context, 12), dp(context, 6))
    }

    private fun action(context: Context, title: String, onClick: () -> Unit) = TextView(context).apply {
        text = title
        setTextColor(if (title.startsWith("Wipe") || title.startsWith("Delete") || title == "Factory Reset") {
            Color.rgb(242, 63, 67)
        } else {
            Color.WHITE
        })
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        setPadding(dp(context, 12), dp(context, 12), dp(context, 12), dp(context, 12))
        isClickable = true
        isFocusable = true
        setOnClickListener { onClick() }
    }

    private fun toggle(context: Context, title: String, key: String, partner: String) = Switch(context).apply {
        text = title
        setTextColor(Color.WHITE)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        setPadding(dp(context, 12), dp(context, 8), dp(context, 12), dp(context, 8))
        isChecked = enabled(key)
        setOnCheckedChangeListener { _, checked ->
            NativeBridge.nativeSetBoolean("unbound", key, checked)
            if (!checked && !enabled(partner)) NativeBridge.nativeSetBoolean("unbound", partner, true)
        }
    }

    private fun confirm(activity: Activity, title: String, onConfirm: () -> Unit) {
        AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle(title)
            .setMessage("This cannot be undone. Discord restarts afterwards.")
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Confirm") { _, _ -> onConfirm() }
            .show()
    }

    private fun run(action: String, argument: String? = null) {
        shown?.dismiss()
        Thread {
            NativeBridge.nativeToolbox(action, argument)
            Platform.restartApp()
        }.start()
    }

    private fun refetchBundle(activity: Activity) {
        shown?.dismiss()
        Toast.makeText(activity, "Refetching the bundle…", Toast.LENGTH_SHORT).show()
        Thread {
            val ok = NativeBridge.nativeToolbox("refetch-bundle", null) == "true"
            main.post {
                if (ok) {
                    Platform.restartApp()
                } else {
                    Toast.makeText(activity, "The bundle could not be downloaded.", Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun loadCustomBundle(activity: Activity) {
        val input = EditText(activity).apply {
            hint = "https://example.com/unbound.bundle"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine()
        }

        AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle("Custom Bundle URL")
            .setMessage("Enter the URL to download a custom bundle from")
            .setView(input)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Download") { _, _ ->
                if (NativeBridge.nativeToolbox("custom-bundle", input.text.toString().trim()) == "true") {
                    shown?.dismiss()
                    Platform.restartApp()
                } else {
                    Toast.makeText(activity, "Enter an http or https URL.", Toast.LENGTH_LONG).show()
                }
            }
            .show()
    }

    private fun copyFolderPath(activity: Activity) {
        val path = File(activity.applicationInfo.dataDir, "files/Unbound").absolutePath
        activity.getSystemService(ClipboardManager::class.java)
            ?.setPrimaryClip(ClipData.newPlainText("Unbound folder", path))
        Toast.makeText(activity, path, Toast.LENGTH_LONG).show()
    }

    private fun openIssue(activity: Activity) {
        val discord = runCatching { activity.packageManager.getPackageInfo(activity.packageName, 0) }.getOrNull()
        val unbound = runCatching { activity.packageManager.getPackageInfo("app.unbound.android", 0) }.getOrNull()
        val environment = JSONObject()
            .put("Device", "${Build.MANUFACTURER} ${Build.MODEL}")
            .put("Android Version", "${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            .put("Discord Version", "${discord?.versionName} (${discord?.longVersionCode})")
            .put("Unbound Version", unbound?.versionName ?: "unknown")
            .put("Emulator", if (Platform.isEmulator()) "Yes" else "No")
        val url = NativeBridge.nativeToolbox(
            "issue-url",
            JSONObject().put("environment", environment).toString(),
        ) ?: return

        runCatching {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }.onFailure {
            Toast.makeText(activity, "No browser can open GitHub.", Toast.LENGTH_LONG).show()
        }
    }

    private fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()
}
