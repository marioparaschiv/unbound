package app.unbound.android

import android.app.Activity
import android.content.Context
import android.view.View
import android.view.ViewGroup
import org.json.JSONObject
import kotlin.math.ceil

object ViewGeometry {
    fun measure(view: View): String = frame(view)?.toString()
        ?: throw IllegalStateException("The Android view has not been laid out")

    fun applyFrame(view: View, frame: JSONObject) {
        applySize(view, frame)
        val location = IntArray(2)
        view.getLocationOnScreen(location)
        val density = view.resources.displayMetrics.density
        view.translationX += (frame.getDouble("x") * density - location[0]).toFloat()
        view.translationY += (frame.getDouble("y") * density - location[1]).toFloat()
    }

    fun applySize(view: View, size: JSONObject) {
        val parameters = view.layoutParams
            ?: throw IllegalStateException("The Android view has no layout parameters")
        val density = view.resources.displayMetrics.density
        parameters.width = ceil(size.getDouble("width") * density).toInt()
        parameters.height = ceil(size.getDouble("height") * density).toInt()
        view.layoutParams = parameters
    }

    fun decorView(context: Context): ViewGroup? =
        (ActivityTracker.currentActivity() ?: context as? Activity)
            ?.window
            ?.decorView as? ViewGroup

    private fun frame(view: View): JSONObject? {
        if (view.width <= 0 || view.height <= 0) return null
        val location = IntArray(2)
        view.getLocationOnScreen(location)
        val density = view.resources.displayMetrics.density
        return JSONObject()
            .put("x", location[0] / density)
            .put("y", location[1] / density)
            .put("width", view.width / density)
            .put("height", view.height / density)
    }
}
