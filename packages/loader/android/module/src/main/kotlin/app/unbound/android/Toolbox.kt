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
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.sqrt

object Toolbox {
    private const val SHAKE = "shake"
    private const val THREE_FINGER = "three-finger"
    private const val SHAKE_GRAVITY = 2.6f
    private const val SHAKE_WINDOW_MS = 900L
    private const val SHAKE_COOLDOWN_MS = 1_500L
    private val MENU_OPTIONS = JSONObject().put("copyAppFolderPath", true).toString()
    private val holdMs by lazy { NativeBridge.nativeToolbox("hold-milliseconds", null)?.toLongOrNull() ?: 0L }

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

            val model = menuModel()
            shown = AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                .setTitle(model.optString("title"))
                .setView(menu(activity, model))
                .setNegativeButton(model.optString("close"), null)
                .show()
        }
    }

    private fun trackPress(activity: Activity, event: MotionEvent) {
        when (event.actionMasked) {
            MotionEvent.ACTION_POINTER_DOWN -> if (event.pointerCount == 3 && enabled(THREE_FINGER)) {
                cancelPress()
                val runnable = Runnable {
                    pressRunnable = null
                    confirmHaptic(activity)
                    show()
                }
                pressRunnable = runnable
                main.postDelayed(runnable, holdMs)
            }

            MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> cancelPress()
        }
    }

    private fun cancelPress() {
        pressRunnable?.let(main::removeCallbacks)
        pressRunnable = null
    }

    private fun trackShake(event: SensorEvent) {
        if (!enabled(SHAKE)) return

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

    private fun enabled(gesture: String): Boolean = NativeBridge.preferenceEnabled("gesture", gesture)

    private fun menuModel(): JSONObject =
        runCatching { JSONObject(NativeBridge.nativeToolbox("menu", MENU_OPTIONS).orEmpty()) }.getOrDefault(JSONObject())

    private fun menu(activity: Activity, model: JSONObject): View {
        val list = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(activity, 8), dp(activity, 4), dp(activity, 8), dp(activity, 4))
        }
        val switches = mutableListOf<Switch>()

        for (section in objects(model.optJSONArray("sections"))) {
            list.addView(header(activity, section.optString("title")))
            for (item in objects(section.optJSONArray("items"))) {
                if (item.optString("kind") == "toggle") {
                    val switch = toggle(activity, item)
                    switches += switch
                    list.addView(switch)
                } else {
                    list.addView(action(activity, item) { select(activity, model, item) })
                }
            }
        }

        for (switch in switches) {
            switch.setOnCheckedChangeListener { changed, checked ->
                NativeBridge.nativePreference("set-gesture", "${changed.tag}=$checked")
                for (other in switches) other.isChecked = enabled(other.tag as String)
            }
        }

        return ScrollView(activity).apply { addView(list) }
    }

    private fun objects(array: JSONArray?): List<JSONObject> =
        (0 until (array?.length() ?: 0)).mapNotNull { array?.optJSONObject(it) }

    private fun header(context: Context, title: String) = TextView(context).apply {
        text = title.uppercase()
        setTextColor(Color.rgb(150, 155, 165))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        typeface = Typeface.DEFAULT_BOLD
        setPadding(dp(context, 12), dp(context, 16), dp(context, 12), dp(context, 6))
    }

    private fun action(context: Context, item: JSONObject, onClick: () -> Unit) = TextView(context).apply {
        text = item.optString("title")
        setTextColor(if (item.optBoolean("destructive")) Color.rgb(242, 63, 67) else Color.WHITE)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        setPadding(dp(context, 12), dp(context, 12), dp(context, 12), dp(context, 12))
        isClickable = true
        isFocusable = true
        setOnClickListener { onClick() }
    }

    private fun toggle(context: Context, item: JSONObject) = Switch(context).apply {
        text = item.optString("title")
        tag = item.optString("gesture")
        setTextColor(Color.WHITE)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        setPadding(dp(context, 12), dp(context, 8), dp(context, 12), dp(context, 8))
        isChecked = item.optBoolean("on")
    }

    private fun menuStep(item: JSONObject, confirmed: Boolean): String? =
        NativeBridge.nativeToolbox("menu-step", JSONObject().put("item", item).put("confirmed", confirmed).toString())

    private fun menuOutcome(item: JSONObject, result: String?): String? =
        NativeBridge.nativeToolbox("menu-outcome", JSONObject().put("item", item).put("result", result).toString())

    private fun select(activity: Activity, model: JSONObject, item: JSONObject) {
        if (menuStep(item, false) != "confirm") return perform(activity, item)

        val confirmation = model.optJSONObject("confirmation") ?: JSONObject()
        AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle(item.optString("title"))
            .setMessage(confirmation.optString("message"))
            .setNegativeButton(confirmation.optString("cancel"), null)
            .setPositiveButton(confirmation.optString("confirm")) { _, _ -> perform(activity, item) }
            .show()
    }

    private fun perform(activity: Activity, item: JSONObject) {
        when (menuStep(item, true)) {
            "platform" -> performPlatform(activity, item)
            "prompt" -> prompt(activity, item, item.getJSONObject("prompt"))
            "run" -> run(activity, item, item.optString("argument"))
        }
    }

    private fun performPlatform(activity: Activity, item: JSONObject) {
        when (item.optString("id")) {
            "copy-app-folder-path" -> copyFolderPath(activity)
            "open-issue" -> openIssue(activity, item)
        }
    }

    private fun prompt(activity: Activity, item: JSONObject, prompt: JSONObject) {
        val input = EditText(activity).apply {
            hint = prompt.optString("placeholder")
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine()
        }

        AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle(prompt.optString("title"))
            .setMessage(prompt.optString("message"))
            .setView(input)
            .setNegativeButton(prompt.optString("cancel"), null)
            .setPositiveButton(prompt.optString("confirm")) { _, _ -> run(activity, item, input.text.toString()) }
            .show()
    }

    private fun run(activity: Activity, item: JSONObject, argument: String) {
        val progress = item.optString("progress")
        if (progress.isNotEmpty()) Toast.makeText(activity, progress, Toast.LENGTH_SHORT).show()

        Thread {
            val result = NativeBridge.nativeToolbox(item.optString("action"), argument)
            val outcome = menuOutcome(item, result)
            main.post {
                when (outcome) {
                    "failed" -> Toast.makeText(activity, item.optString("failure"), Toast.LENGTH_LONG).show()

                    "restart" -> {
                        shown?.dismiss()
                        Platform.restartApp()
                    }
                }
            }
        }.start()
    }

    private fun copyFolderPath(activity: Activity) {
        val path = NativeBridge.documents
        activity.getSystemService(ClipboardManager::class.java)
            ?.setPrimaryClip(ClipData.newPlainText("Unbound folder", path))
        Toast.makeText(activity, path, Toast.LENGTH_LONG).show()
    }

    private fun openIssue(activity: Activity, item: JSONObject) {
        val discord = runCatching { activity.packageManager.getPackageInfo(activity.packageName, 0) }.getOrNull()
        val version = discord?.let { "${it.versionName} (${it.longVersionCode})" }.orEmpty()

        runCatching {
            val url = NativeBridge.nativeToolbox("issue-url", version)
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(requireNotNull(url))))
        }.onFailure {
            Toast.makeText(activity, item.optString("failure"), Toast.LENGTH_LONG).show()
        }
    }

    private fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()
}
