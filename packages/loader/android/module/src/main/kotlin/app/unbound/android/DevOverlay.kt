package app.unbound.android

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.Toast
import org.json.JSONObject
import java.lang.ref.WeakReference
import kotlin.math.abs

object DevOverlay {
    private const val PREFERENCES = "unbound-dev-overlay"
    private const val X_KEY = "x"
    private const val Y_KEY = "y"
    private const val BUTTON_SIDE_DP = 44
    private const val MARGIN_DP = 8
    private const val DRAG_SLOP_DP = 6

    private var button: WeakReference<View>? = null

    fun shouldShow(): Boolean =
        Platform.isEmulator() || NativeBridge.nativeGetBoolean("unbound", "developer-mode", false)

    fun onResumed(activity: Activity) {
        val decor = activity.window?.decorView as? ViewGroup ?: return
        val existing = button?.get()

        if (!shouldShow()) {
            (existing?.parent as? ViewGroup)?.removeView(existing)
            button = null
            return
        }

        if (existing?.parent === decor) return

        (existing?.parent as? ViewGroup)?.removeView(existing)
        val view = createButton(activity)
        decor.addView(view)
        button = WeakReference(view)
        decor.post { place(activity, view, decor) }
    }

    private fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    @SuppressLint("ClickableViewAccessibility")
    private fun createButton(activity: Activity): View {
        val side = dp(activity, BUTTON_SIDE_DP)
        val view = ImageView(activity).apply {
            setImageResource(android.R.drawable.ic_menu_manage)
            setColorFilter(Color.WHITE)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            setPadding(dp(activity, 10), dp(activity, 10), dp(activity, 10), dp(activity, 10))
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.argb(200, 30, 31, 34))
                setStroke(dp(activity, 1), Color.argb(90, 255, 255, 255))
            }
            elevation = dp(activity, 6).toFloat()
            contentDescription = "Unbound developer menu"
            layoutParams = FrameLayout.LayoutParams(side, side, Gravity.TOP or Gravity.START)
        }
        var downX = 0f
        var downY = 0f
        var startX = 0f
        var startY = 0f
        var dragging = false

        view.setOnTouchListener { touched, event ->
            val parent = touched.parent as? View ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX
                    downY = event.rawY
                    startX = touched.x
                    startY = touched.y
                    dragging = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downX
                    val dy = event.rawY - downY
                    if (!dragging && (abs(dx) > dp(activity, DRAG_SLOP_DP) || abs(dy) > dp(activity, DRAG_SLOP_DP))) {
                        dragging = true
                    }
                    if (dragging) {
                        touched.x = clamp(startX + dx, parent.width - touched.width, activity)
                        touched.y = clamp(startY + dy, parent.height - touched.height, activity)
                    }
                }
                MotionEvent.ACTION_UP -> {
                    if (dragging) {
                        persist(activity, touched, parent)
                    } else {
                        showMenu(activity)
                    }
                }
            }
            true
        }

        return view
    }

    private fun clamp(value: Float, limit: Int, context: Context): Float {
        val margin = dp(context, MARGIN_DP).toFloat()
        return value.coerceIn(margin, (limit - margin).coerceAtLeast(margin))
    }

    private fun place(activity: Activity, view: View, parent: View) {
        val preferences = activity.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        val relativeX = preferences.getFloat(X_KEY, 1f)
        val relativeY = preferences.getFloat(Y_KEY, 0.7f)

        view.x = clamp(relativeX * (parent.width - view.width), parent.width - view.width, activity)
        view.y = clamp(relativeY * (parent.height - view.height), parent.height - view.height, activity)
    }

    private fun persist(activity: Activity, view: View, parent: View) {
        val width = (parent.width - view.width).coerceAtLeast(1)
        val height = (parent.height - view.height).coerceAtLeast(1)

        activity.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit()
            .putFloat(X_KEY, view.x / width)
            .putFloat(Y_KEY, view.y / height)
            .apply()
    }

    private fun showMenu(activity: Activity) {
        val items = arrayOf("Reload Bundle", "Edit Settings JSON", "Open Unbound Toolbox")

        AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle("Developer")
            .setItems(items) { _, index ->
                when (index) {
                    0 -> Platform.restartApp()
                    1 -> editSettings(activity)
                    2 -> Toolbox.show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun editSettings(activity: Activity) {
        val current = NativeBridge.nativeToolbox("settings", null) ?: "{}"
        val pretty = runCatching { JSONObject(current).toString(2) }.getOrDefault(current)
        val editor = EditText(activity).apply {
            setText(pretty)
            typeface = Typeface.MONOSPACE
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            isSingleLine = false
            gravity = Gravity.TOP or Gravity.START
            minLines = 12
            maxLines = 24
            setHorizontallyScrolling(true)
        }

        AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle("Settings JSON")
            .setView(editor)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save") { _, _ ->
                val text = editor.text.toString()
                val valid = runCatching { JSONObject(text) }.isSuccess

                if (valid && NativeBridge.nativeToolbox("replace-settings", text) == "true") {
                    Platform.restartApp()
                } else {
                    Toast.makeText(activity, "The settings are not valid JSON.", Toast.LENGTH_LONG).show()
                }
            }
            .show()
    }
}
