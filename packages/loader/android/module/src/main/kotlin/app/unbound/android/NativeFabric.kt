package app.unbound.android

import android.content.Context
import android.os.Bundle
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.ceil

object NativeFabric {
    private const val MAX_SURFACES = 64
    private const val MAX_MODULE_NAME_LENGTH = 128

    interface Surface {
        fun view(): View
        fun start()
        fun stop()
        fun updateProps(props: Bundle)
        fun isRunning(): Boolean
    }

    interface Host {
        fun createSurface(context: Context, moduleName: String, props: Bundle): Surface
        fun activityContext(): Context?
    }

    private class Mounted(val surface: Surface, val view: View)

    private val mounted = HashMap<String, Mounted>()
    private var nextSurface = 1L
    private var host: Host? = null

    fun useHost(value: Host) {
        synchronized(this) { host = value }
    }

    fun mount(containerHandleJSON: String, moduleName: String, propsJSON: String): String {
        requireMainThread()
        require(moduleName.isNotEmpty() && moduleName.length <= MAX_MODULE_NAME_LENGTH) {
            "The React surface module name is out of bounds"
        }

        val host = synchronized(this) { host }
            ?: throw IllegalStateException("The React surface host is unavailable")

        synchronized(this) {
            require(mounted.size < MAX_SURFACES) { "Too many React surfaces are mounted" }
        }

        val context = host.activityContext()
            ?: throw IllegalStateException("No resumed Android activity is available")
        val container = containerFor(containerHandleJSON, context)
        val surface = host.createSurface(context, moduleName, bundle(JSONObject(propsJSON)))
        surface.start()

        val view = surface.view()
        container.addView(view, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ))

        val id = synchronized(this) {
            val handle = "surface-${nextSurface++}"
            mounted[handle] = Mounted(surface, view)
            handle
        }

        return JSONObject().put("id", id).toString()
    }

    fun update(handleJSON: String, propsJSON: String) {
        requireMainThread()
        resolve(parseHandle(handleJSON)).surface.updateProps(bundle(JSONObject(propsJSON)))
    }

    fun unmount(handleJSON: String) {
        requireMainThread()
        val id = parseHandle(handleJSON)
        val entry = synchronized(this) { mounted.remove(id) } ?: return
        (entry.view.parent as? ViewGroup)?.removeView(entry.view)
        entry.surface.stop()
    }

    fun setSize(handleJSON: String, minimumJSON: String, maximumJSON: String) {
        requireMainThread()
        val view = resolve(parseHandle(handleJSON)).view
        val minimum = JSONObject(minimumJSON)
        val density = view.resources.displayMetrics.density
        view.minimumWidth = ceil(minimum.getDouble("width") * density).toInt()
        view.minimumHeight = ceil(minimum.getDouble("height") * density).toInt()
        NativeUI.applySize(view, JSONObject(maximumJSON))
    }

    fun setFrame(handleJSON: String, frameJSON: String) {
        requireMainThread()
        NativeUI.applyFrame(resolve(parseHandle(handleJSON)).view, JSONObject(frameJSON))
    }

    fun measure(handleJSON: String): String {
        requireMainThread()
        return NativeUI.measure(viewFor(handleJSON))
    }

    fun unmountAll() {
        val entries = synchronized(this) {
            val all = mounted.values.toList()
            mounted.clear()
            all
        }

        for (entry in entries) {
            runCatching {
                (entry.view.parent as? ViewGroup)?.removeView(entry.view)
                entry.surface.stop()
            }
        }
    }

    fun mountedCount(): Int = synchronized(this) { mounted.size }

    private fun containerFor(containerHandleJSON: String, context: Context): ViewGroup {
        if (containerHandleJSON.isBlank() || containerHandleJSON == "{}") {
            val root = NativeUI.decorView(context)
                ?: throw IllegalStateException("The Android activity has no content view")
            return root
        }

        val container = if (NativeJava.isJavaHandle(containerHandleJSON)) {
            NativeJava.objectForHandle(containerHandleJSON)
        } else {
            NativeUI.viewForHandle(containerHandleJSON)
        }
        require(container is ViewGroup) { "A React surface container cannot contain child views" }

        return container
    }

    private fun viewFor(handleJSON: String): View {
        val id = parseHandle(handleJSON)
        synchronized(this) { mounted[id] }?.let { return it.view }
        val view = if (NativeJava.isJavaHandle(handleJSON)) {
            NativeJava.objectForHandle(handleJSON)
        } else {
            NativeUI.viewForHandle(handleJSON)
        }
        require(view is View) { "The measured handle is not an Android view" }
        return view
    }

    private fun resolve(id: String): Mounted = synchronized(this) {
        mounted[id] ?: throw IllegalArgumentException("The React surface handle is unavailable")
    }

    private fun parseHandle(handleJSON: String): String {
        val id = JSONObject(handleJSON).optString("id").trim()
        require(id.isNotEmpty() && id.length <= 128) { "The React surface handle is out of bounds" }

        return id
    }

    fun bundle(props: JSONObject): Bundle {
        val result = Bundle()
        for (key in props.keys()) {
            when (val value = props.get(key)) {
                JSONObject.NULL -> result.putString(key, null)
                is Boolean -> result.putBoolean(key, value)
                is Int -> result.putInt(key, value)
                is Long -> result.putLong(key, value)
                is Double -> result.putDouble(key, value)
                is String -> result.putString(key, value)
                is JSONObject -> result.putBundle(key, bundle(value))
                is JSONArray -> putArray(result, key, value)
                else -> result.putString(key, value.toString())
            }
        }

        return result
    }

    private fun putArray(target: Bundle, key: String, values: JSONArray) {
        val first = if (values.length() > 0) values.get(0) else null
        when (first) {
            is String -> target.putStringArray(
                key,
                Array(values.length()) { values.optString(it) },
            )
            is Int -> target.putIntArray(key, IntArray(values.length()) { values.optInt(it) })
            is Double -> target.putDoubleArray(
                key,
                DoubleArray(values.length()) { values.optDouble(it) },
            )
            is Boolean -> target.putBooleanArray(
                key,
                BooleanArray(values.length()) { values.optBoolean(it) },
            )
            is JSONObject -> {
                val bundles = ArrayList<Bundle>(values.length())
                for (index in 0 until values.length()) {
                    bundles.add(bundle(values.getJSONObject(index)))
                }
                target.putParcelableArrayList(key, bundles)
            }
            else -> target.putStringArray(key, emptyArray())
        }
    }

    private fun requireMainThread() {
        check(Looper.myLooper() == Looper.getMainLooper()) {
            "React surface operations must run on the main thread"
        }
    }
}
