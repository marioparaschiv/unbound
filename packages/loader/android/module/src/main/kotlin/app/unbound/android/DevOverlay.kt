package app.unbound.android

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference
import kotlin.math.abs
import kotlin.math.roundToInt

object DevOverlay {
    private const val DRAG_SLOP_DP = 6

    private var button: WeakReference<View>? = null

    @Volatile var debugBuild = false

    fun shouldShow(): Boolean {
        val flags = listOfNotNull("virtual-device".takeIf { Platform.isEmulator() }, "debug-build".takeIf { debugBuild })
        return NativeBridge.nativePreference("dev-overlay", flags.joinToString(",")) == "true"
    }

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
        decor.post { place(view, decor) }
    }

    private fun density(view: View): Double = view.resources.displayMetrics.density.toDouble()

    private fun dp(activity: Activity, value: Int): Int =
        (value * activity.resources.displayMetrics.density).roundToInt()

    @SuppressLint("ClickableViewAccessibility")
    private fun createButton(activity: Activity): View {
        val side = (NativeBridge.nativeDevOverlayButtonSide() * activity.resources.displayMetrics.density).roundToInt()
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
        var startCenter = doubleArrayOf(0.0, 0.0)
        var dragging = false

        view.setOnTouchListener { touched, event ->
            val parent = touched.parent as? View ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX
                    downY = event.rawY
                    startCenter = center(touched)
                    dragging = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downX
                    val dy = event.rawY - downY
                    if (!dragging && (abs(dx) > dp(activity, DRAG_SLOP_DP) || abs(dy) > dp(activity, DRAG_SLOP_DP))) {
                        dragging = true
                    }
                    if (dragging) {
                        val density = density(touched)
                        NativeBridge.nativeClampDevOverlayCenter(
                            startCenter[0] + dx / density,
                            startCenter[1] + dy / density,
                            bounds(parent),
                        )?.let { moveTo(touched, it) }
                    }
                }
                MotionEvent.ACTION_UP -> {
                    if (dragging) {
                        val current = center(touched)
                        NativeBridge.nativeSaveDevOverlayCenter(current[0], current[1], bounds(parent))
                    } else {
                        showMenu(activity)
                    }
                }
            }
            true
        }

        return view
    }

    private fun place(view: View, parent: View) {
        NativeBridge.nativeDevOverlayCenter(bounds(parent))?.let { moveTo(view, it) }
    }

    private fun halfSide(view: View): Float = view.layoutParams.width / 2f

    private fun center(view: View): DoubleArray {
        val density = density(view)
        return doubleArrayOf((view.x + halfSide(view)) / density, (view.y + halfSide(view)) / density)
    }

    private fun moveTo(view: View, center: DoubleArray) {
        val density = density(view)
        view.x = (center[0] * density).toFloat() - halfSide(view)
        view.y = (center[1] * density).toFloat() - halfSide(view)
    }

    private fun bounds(parent: View): DoubleArray {
        val density = density(parent)
        val insets = systemInsets(parent)
        return doubleArrayOf(
            parent.width / density,
            parent.height / density,
            insets.top / density,
            insets.left / density,
            insets.bottom / density,
            insets.right / density,
        )
    }

    @Suppress("DEPRECATION")
    private fun systemInsets(view: View): Rect {
        val insets = view.rootWindowInsets ?: return Rect()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
            return Rect(bars.left, bars.top, bars.right, bars.bottom)
        }
        val cutout = insets.displayCutout
        return Rect(
            maxOf(insets.systemWindowInsetLeft, cutout?.safeInsetLeft ?: 0),
            maxOf(insets.systemWindowInsetTop, cutout?.safeInsetTop ?: 0),
            maxOf(insets.systemWindowInsetRight, cutout?.safeInsetRight ?: 0),
            maxOf(insets.systemWindowInsetBottom, cutout?.safeInsetBottom ?: 0),
        )
    }

    private fun objects(array: JSONArray?): List<JSONObject> =
        (0 until (array?.length() ?: 0)).mapNotNull { array?.optJSONObject(it) }

    private fun showMenu(activity: Activity) {
        val model = runCatching { JSONObject(NativeBridge.nativeToolbox("developer-menu", null).orEmpty()) }
            .getOrDefault(JSONObject())
        val items = objects(model.optJSONArray("items"))
        val editor = model.optJSONObject("editor") ?: JSONObject()

        AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle(model.optString("title"))
            .setItems(items.map { it.optString("title") }.toTypedArray()) { _, index ->
                perform(activity, items[index], editor)
            }
            .setNegativeButton(model.optString("cancel"), null)
            .show()
    }

    private fun perform(activity: Activity, item: JSONObject, editor: JSONObject) {
        item.optString("action").takeIf { it.isNotEmpty() }?.let { NativeBridge.nativePreference(it, null) }
        when (item.optString("followUp")) {
            "reload-chat" -> ChatUI.reload()
            "reload-app" -> Platform.restartApp()
            "edit-settings" -> editSettings(activity, editor)
            "open-toolbox" -> Toolbox.show()
        }
    }

    private fun editSettings(activity: Activity, editor: JSONObject) {
        val input = EditText(activity).apply {
            setText(NativeBridge.nativeToolbox("settings", null) ?: "{}")
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

        val dialog = AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle(editor.optString("title"))
            .setView(input)
            .setNegativeButton(editor.optString("cancel"), null)
            .setPositiveButton(editor.optString("save"), null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val result = runCatching {
                    JSONObject(NativeBridge.nativeToolbox("save-settings", input.text.toString()).orEmpty())
                }.getOrDefault(JSONObject())
                if (result.optBoolean("saved")) dialog.dismiss() else input.error = result.optString("error")
            }
        }
        dialog.show()
    }
}
