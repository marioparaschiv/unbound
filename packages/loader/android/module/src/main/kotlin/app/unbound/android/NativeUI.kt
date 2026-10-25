package app.unbound.android

import android.app.Activity
import android.graphics.Color
import android.graphics.Rect
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.widget.Button
import android.widget.CompoundButton
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.ArrayDeque
import java.util.WeakHashMap
import kotlin.math.ceil

object NativeUI {
    internal var colorParser: (String) -> Int? = NativeBridge::parseColor

    private data class Query(
        val role: String,
        val root: String?,
        val attributes: JSONObject,
        val maxDepth: Int,
        val maxNodes: Int,
        val maxResults: Int,
    )

    private data class Visit(val view: View, val parent: View?, val depth: Int)

    private val viewsByObject = WeakHashMap<View, String>()
    private val viewsByHandle = HashMap<String, WeakReference<View>>()
    private var handleGeneration = -1L
    private var nextHandle = 1L

    fun lookup(queryJSON: String): String {
        requireMainThread()
        val query = parseQuery(queryJSON)
        val handles = JSONArray()

        for (visit in traverse(query)) {
            if (matches(visit.view, query)) handles.put(JSONObject().put("id", handle(visit.view)))
            if (handles.length() >= query.maxResults) break
        }

        return handles.toString()
    }

    fun snapshot(queryJSON: String): String {
        requireMainThread()
        val query = parseQuery(queryJSON)
        val nodes = JSONArray()

        for (visit in traverse(query)) {
            if (!matches(visit.view, query)) continue

            val parent = visit.parent?.let { JSONObject().put("id", handle(it)) }
            val frame = frame(visit.view)
            val node = JSONObject()
                .put("id", JSONObject().put("id", handle(visit.view)))
                .put("parent", parent ?: JSONObject.NULL)
                .put("role", role(visit.view))
                .put("frame", frame ?: JSONObject.NULL)
                .put("attributes", attributes(visit.view))
            nodes.put(node)

            if (nodes.length() >= query.maxResults) break
        }

        return JSONObject()
            .put("generation", ActivityTracker.generation)
            .put("nodes", nodes)
            .toString()
    }

    fun measureView(handleJSON: String): String {
        requireMainThread()
        val handle = parseHandle(handleJSON)
        val measured = frame(resolve(handle))
            ?: throw IllegalStateException("The Android native UI view has not been laid out")
        return measured.toString()
    }

    fun mountView(containerHandleJSON: String, moduleName: String, propertiesJSON: String): String {
        requireMainThread()
        require(moduleName.length in 1..128)

        val activity = ActivityTracker.currentActivity()
            ?: throw IllegalStateException("No resumed Android activity is available")
        val container = if (containerHandleJSON.isBlank()) {
            activity.window?.decorView
        } else {
            resolve(parseHandle(containerHandleJSON))
        } ?: throw IllegalStateException("The Android activity has no content view")
        require(container is ViewGroup) { "The native UI container cannot contain child views" }

        val view = createView(activity, moduleName)
        applyProperties(view, JSONObject(propertiesJSON))
        container.addView(view, layoutParams(container))
        return JSONObject().put("id", handle(view)).toString()
    }

    fun updateView(handleJSON: String, propertiesJSON: String) {
        requireMainThread()
        val view = resolve(parseHandle(handleJSON))
        applyProperties(view, JSONObject(propertiesJSON))
        view.requestLayout()
        view.invalidate()
    }

    fun unmountView(handleJSON: String) {
        requireMainThread()
        val view = resolve(parseHandle(handleJSON))
        if (view is ImageView) NativeImageLoader.clear(view)
        (view.parent as? ViewGroup)?.removeView(view)
        viewsByObject.remove(view)
        viewsByHandle.remove(parseHandle(handleJSON))
    }

    fun setViewFrame(handleJSON: String, frameJSON: String) {
        requireMainThread()
        val view = resolve(parseHandle(handleJSON))
        val frame = JSONObject(frameJSON)
        val x = boundedCoordinate(frame, "x")
        val y = boundedCoordinate(frame, "y")
        val width = boundedDimension(frame, "width")
        val height = boundedDimension(frame, "height")
        val parameters = view.layoutParams
            ?: throw IllegalStateException("The Android native UI view has no layout parameters")
        val location = IntArray(2)
        view.getLocationOnScreen(location)
        val density = view.resources.displayMetrics.density
        parameters.width = ceil(width * density).toInt()
        parameters.height = ceil(height * density).toInt()
        view.layoutParams = parameters
        view.translationX += (x * density - location[0]).toFloat()
        view.translationY += (y * density - location[1]).toFloat()
    }

    private fun parseQuery(queryJSON: String): Query {
        val input = JSONObject(queryJSON)
        val role = input.optString("role").trim()
        require(role.isNotEmpty() && role.length <= 128)

        val rootID = input.optJSONObject("root")?.optString("id")?.takeIf { it.isNotEmpty() }
        return Query(
            role = role,
            root = rootID,
            attributes = input.optJSONObject("attributes") ?: JSONObject(),
            maxDepth = input.optInt("maxDepth", 16).coerceIn(1, 64),
            maxNodes = input.optInt("maxNodes", 512).coerceIn(1, 2000),
            maxResults = input.optInt("maxResults", 128).coerceIn(1, 500),
        )
    }

    fun viewForHandle(handleJSON: String): View = resolve(parseHandle(handleJSON))

    fun handleForView(view: View): String = JSONObject().put("id", handle(view)).toString()

    fun decorView(context: android.content.Context): ViewGroup? =
        (ActivityTracker.currentActivity() ?: context as? Activity)
            ?.window
            ?.decorView as? ViewGroup

    private fun parseHandle(handleJSON: String): String {
        val id = JSONObject(handleJSON).optString("id").trim()
        require(id.isNotEmpty() && id.length <= 128)
        return id
    }

    private fun boundedCoordinate(frame: JSONObject, name: String): Double {
        val value = frame.optDouble(name, Double.NaN)
        require(value.isFinite() && value in -100_000.0..100_000.0)
        return value
    }

    private fun boundedDimension(frame: JSONObject, name: String): Double {
        val value = frame.optDouble(name, Double.NaN)
        require(value.isFinite() && value > 0 && value <= 32_768.0)
        return value
    }

    private fun traverse(query: Query): List<Visit> {
        val activity = ActivityTracker.currentActivity()
            ?: throw IllegalStateException("No resumed Android activity is available")
        val root = query.root?.let(::resolve) ?: activity.window?.decorView
            ?: throw IllegalStateException("The Android activity has no content view")
        val queue = ArrayDeque<Visit>()
        val result = ArrayList<Visit>()
        queue.addLast(Visit(root, null, 0))

        while (queue.isNotEmpty() && result.size < query.maxNodes) {
            val current = queue.removeFirst()
            result.add(current)

            if (current.depth >= query.maxDepth || current.view !is ViewGroup) continue

            for (index in 0 until current.view.childCount) {
                queue.addLast(Visit(current.view.getChildAt(index), current.view, current.depth + 1))
            }
        }

        return result
    }

    private fun resolve(id: String): View {
        synchronizeGeneration()
        if (!id.startsWith("$handleGeneration-")) {
            throw IllegalArgumentException("The Android native UI handle is stale")
        }

        return viewsByHandle[id]?.get()
            ?: throw IllegalArgumentException("The Android native UI handle is unavailable")
    }

    private fun handle(view: View): String {
        synchronizeGeneration()
        viewsByObject[view]?.let { return it }

        val id = "$handleGeneration-${nextHandle++}"
        viewsByObject[view] = id
        viewsByHandle[id] = WeakReference(view)
        return id
    }

    private fun synchronizeGeneration() {
        if (handleGeneration == ActivityTracker.generation) return
        viewsByObject.clear()
        viewsByHandle.clear()
        handleGeneration = ActivityTracker.generation
    }

    private fun matches(view: View, query: Query): Boolean {
        if (query.role != "*" && query.role != role(view) && query.role != view.javaClass.name &&
            query.role != view.javaClass.simpleName
        ) return false

        val values = attributes(view)
        val keys = query.attributes.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            if (query.attributes.opt(key) != values.opt(key)) return false
        }

        return true
    }

    private fun role(view: View): String = when (view) {
        is ImageButton, is Button, is CompoundButton -> "button"
        is EditText -> "input"
        is ImageView -> "image"
        is TextView -> "text"
        is ViewGroup -> "container"
        else -> "view"
    }

    private fun attributes(view: View): JSONObject {
        val rectangle = Rect()
        view.getGlobalVisibleRect(rectangle)
        val values = JSONObject()
            .put("className", view.javaClass.name)
            .put("simpleClassName", view.javaClass.simpleName)
            .put("viewId", view.id)
            .put("clickable", view.isClickable)
            .put("enabled", view.isEnabled)
            .put("selected", view.isSelected)
            .put("visible", view.isShown && rectangle.width() > 0 && rectangle.height() > 0)

        val description = view.contentDescription?.toString()?.take(256)
        if (description != null) values.put("contentDescription", description)

        if (view is TextView) values.put("text", view.text?.toString()?.take(256) ?: "")

        if (view.id != View.NO_ID) {
            val resourceName = runCatching { view.resources.getResourceEntryName(view.id) }.getOrNull()
            if (resourceName != null) values.put("resourceName", resourceName)
        }

        return values
    }

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

    private fun createView(activity: Activity, moduleName: String): View = when (moduleName) {
        "View" -> FrameLayout(activity)
        "Text" -> TextView(activity)
        "Button" -> Button(activity)
        "Image" -> ImageView(activity)
        "LinearLayout" -> LinearLayout(activity)
        else -> throw IllegalArgumentException("Unsupported Android native UI module: $moduleName")
    }

    private fun layoutParams(container: ViewGroup): ViewGroup.LayoutParams = when (container) {
        is FrameLayout -> FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        )
        is LinearLayout -> LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        )
        else -> ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        )
    }

    private fun applyProperties(view: View, properties: JSONObject) {
        val keys = properties.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            when (key) {
                "text" -> {
                    require(view is TextView) { "The Android native UI view does not support text" }
                    val value = properties.optString(key)
                    require(value.length <= 4096)
                    view.text = value
                }
                "textColor" -> {
                    require(view is TextView) { "The Android native UI view does not support textColor" }
                    view.setTextColor(parseColor(properties, key))
                }
                "textSize" -> {
                    require(view is TextView) { "The Android native UI view does not support textSize" }
                    val value = boundedNumber(properties, key, 1.0, 128.0)
                    view.textSize = value.toFloat()
                }
                "sourceUri" -> {
                    require(view is ImageView) { "The Android native UI view does not support sourceUri" }
                    NativeImageLoader.load(view, properties.getString(key))
                }
                "scaleType" -> {
                    require(view is ImageView) { "The Android native UI view does not support scaleType" }
                    view.scaleType = when (properties.getString(key)) {
                        "centerCrop" -> ImageView.ScaleType.CENTER_CROP
                        "centerInside" -> ImageView.ScaleType.CENTER_INSIDE
                        "fitCenter" -> ImageView.ScaleType.FIT_CENTER
                        "fitXY" -> ImageView.ScaleType.FIT_XY
                        else -> throw IllegalArgumentException("The Android native image scale type is invalid")
                    }
                }
                "borderRadius" -> {
                    val radius = boundedNumber(properties, key, 0.0, 512.0)
                    if (radius == 0.0) {
                        view.clipToOutline = false
                    } else {
                        val pixels = radius * view.resources.displayMetrics.density
                        view.outlineProvider = object : ViewOutlineProvider() {
                            override fun getOutline(view: View, outline: android.graphics.Outline) {
                                outline.setRoundRect(0, 0, view.width, view.height, pixels.toFloat())
                            }
                        }
                        view.clipToOutline = true
                    }
                }
                "backgroundColor" -> view.setBackgroundColor(parseColor(properties, key))
                "contentDescription" -> {
                    val value = properties.optString(key)
                    require(value.length <= 256)
                    view.contentDescription = value
                }
                "padding" -> {
                    val value = boundedNumber(properties, key, 0.0, 128.0)
                    val pixels = ceil(value * view.resources.displayMetrics.density).toInt()
                    view.setPadding(pixels, pixels, pixels, pixels)
                }
                "enabled" -> view.isEnabled = properties.getBoolean(key)
                "alpha" -> view.alpha = boundedNumber(properties, key, 0.0, 1.0).toFloat()
                "visible" -> view.visibility = if (properties.getBoolean(key)) View.VISIBLE else View.GONE
                "orientation" -> {
                    require(view is LinearLayout) { "The Android native UI view does not support orientation" }
                    view.orientation = when (properties.getString(key)) {
                        "horizontal" -> LinearLayout.HORIZONTAL
                        "vertical" -> LinearLayout.VERTICAL
                        else -> throw IllegalArgumentException("The Android native UI orientation is invalid")
                    }
                }
                "gravity" -> {
                    val gravity = when (properties.getString(key)) {
                        "start" -> Gravity.START
                        "center" -> Gravity.CENTER
                        "end" -> Gravity.END
                        "top" -> Gravity.TOP
                        "bottom" -> Gravity.BOTTOM
                        else -> throw IllegalArgumentException("The Android native UI gravity is invalid")
                    }
                    when (view) {
                        is TextView -> view.gravity = gravity
                        is LinearLayout -> view.gravity = gravity
                        else -> throw IllegalArgumentException("The Android native UI view does not support gravity")
                    }
                }
                else -> throw IllegalArgumentException("Unsupported Android native UI property: $key")
            }
        }
    }

    private fun boundedNumber(properties: JSONObject, name: String, minimum: Double, maximum: Double): Double {
        val value = properties.optDouble(name, Double.NaN)
        require(value.isFinite() && value in minimum..maximum)
        return value
    }

    private fun parseColor(properties: JSONObject, name: String): Int {
        val value = properties.getString(name)
        require(value.length <= 32)
        return requireNotNull(colorParser(value)) { "Invalid color: $value" }
    }

    private fun requireMainThread() {
        check(Looper.myLooper() == Looper.getMainLooper())
    }
}
