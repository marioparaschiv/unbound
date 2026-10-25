package app.unbound.android

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.ColorDrawable
import android.os.Handler
import android.os.Looper
import android.text.SpannableStringBuilder
import android.text.style.AbsoluteSizeSpan
import android.text.style.ImageSpan
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.TextView
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.WeakHashMap

object TextRewrites {
    private const val MAX_RULES = 256
    private const val MAX_CHAIN = 4
    private const val SPAN_EXCLUSIVE_EXCLUSIVE = 33
    private const val PLACEHOLDER = '￼'
    private const val RECYCLER_VIEW = "androidx.recyclerview.widget.RecyclerView"
    private const val MAX_ANCESTOR_DEPTH = 12
    private const val DESCRIBE_DEPTH = 6
    private const val MAX_CONTENT_RETRIES = 20
    private const val CONTENT_RETRY_DELAY_MS = 100L
    private const val MAX_IMAGES = 128
    private const val ALIGN_CENTER = 2

    private data class Edit(
        val start: Int,
        val end: Int,
        val text: String,
        val spacerOffset: Int,
        val width: Int,
        val height: Int,
        val clearFrom: Int,
        val clearTo: Int,
        val collapseNext: Boolean,
        val imageKey: String?,
        val imageOffset: Int,
        val imageSize: Int,
        val stretchFrom: Int,
        val stretchTo: Int,
        val stretchClasses: Set<String>,
    )

    private data class Rule(val rendered: String, val edits: List<Edit>)

    private data class Anchor(
        val placeholder: Int,
        val width: Int,
        val height: Int,
        val pinTop: Boolean,
        val offsetY: Int,
    )

    private class Slot(val host: View, var anchor: Anchor)

    private class Group(val id: String, val rendered: String) {
        val slots = mutableListOf<Slot>()
        var owner: WeakReference<TextView>? = null
    }

    private val lock = Any()
    private val main = Handler(Looper.getMainLooper())
    private val rules = object : LinkedHashMap<String, Rule>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Rule>?) = size > MAX_RULES
    }
    private val renderedTexts = mutableSetOf<String>()
    private val watched = mutableSetOf<String>()
    private val originals = WeakHashMap<TextView, CharSequence>()
    private val shown = WeakHashMap<TextView, Set<String>>()
    private val groups = HashMap<String, MutableList<Group>>()
    private val groupsById = HashMap<String, Group>()
    private val pendingLayout = WeakHashMap<TextView, Boolean>()
    private val contentRetries = WeakHashMap<TextView, Int>()
    private val listening = WeakHashMap<TextView, Boolean>()
    private val images = object : LinkedHashMap<String, Bitmap>(32, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Bitmap>?) = size > MAX_IMAGES
    }
    private var installed = false

    @Volatile
    private var lastEvent: String? = null

    fun install(xposed: XposedInterface) {
        if (installed) return

        val setText = TextView::class.java.getDeclaredMethod(
            "setText",
            CharSequence::class.java,
            TextView.BufferType::class.java,
        )
        xposed.hook(setText)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val view = chain.thisObject as? TextView
                if (view == null || !isWatched(view)) return@intercept chain.proceed()

                val text = chain.getArg(0) as CharSequence?
                val stages = linkedSetOf<String>()
                val rewritten = rewrite(view, text, stages)
                val result = if (rewritten !== text) {
                    chain.proceed(arrayOf(rewritten, chain.getArg(1))).also { settleLayout(view) }
                } else {
                    chain.proceed()
                }
                runCatching { onTextShown(view, stages) }
                    .onFailure { Logger.error("plugins", "Text rewrite hosts failed", it) }
                result
            }
        installed = true
    }

    fun watch(className: String) {
        synchronized(lock) { watched.add(className) }
    }

    fun put(original: String, rendered: String, editsJSON: String) {
        val edits = parseEdits(editsJSON).sortedByDescending { it.start }
        synchronized(lock) {
            rules[original] = Rule(rendered, edits)
            renderedTexts.add(rendered)
        }
    }

    fun putImage(key: String, bitmap: Bitmap) {
        synchronized(lock) { images[key] = bitmap }
    }

    fun hasImage(key: String): Boolean = synchronized(lock) { images.containsKey(key) }

    fun remove(original: String) {
        synchronized(lock) { rules.remove(original)?.let { renderedTexts.remove(it.rendered) } }
    }

    fun addHost(groupId: String, rendered: String, host: View, anchorJSON: String) {
        val anchor = parseAnchor(anchorJSON)
        synchronized(lock) {
            val group = groupsById.getOrPut(groupId) {
                Group(groupId, rendered).also { groups.getOrPut(rendered) { mutableListOf() }.add(it) }
            }
            group.slots.add(Slot(host, anchor))
        }
        main.post { claimFor(rendered) }
    }

    fun updateAnchor(host: View, anchorJSON: String) {
        val anchor = parseAnchor(anchorJSON)
        val owner = synchronized(lock) {
            val group = groupsById.values.firstOrNull { group -> group.slots.any { it.host === host } }
            group?.slots?.firstOrNull { it.host === host }?.anchor = anchor
            group?.owner?.get()
        }
        if (owner != null) main.post { schedulePosition(owner) }
    }

    fun removeGroup(groupId: String) {
        val group = synchronized(lock) {
            groupsById.remove(groupId)?.also { removed -> groups[removed.rendered]?.remove(removed) }
        } ?: return
        main.post {
            for (slot in group.slots) {
                slot.host.visibility = View.GONE
                (slot.host.parent as? ViewGroup)?.removeView(slot.host)
            }
        }
    }

    fun reapply(textView: TextView) {
        main.post {
            val text = synchronized(lock) { originals[textView] } ?: textView.text
            textView.setText(text, TextView.BufferType.SPANNABLE)
            settleLayout(textView)
        }
    }

    private fun settleLayout(view: View) {
        view.post {
            if (!view.isAttachedToWindow) return@post
            val list = outermostList(view) ?: return@post
            var node: View? = view
            while (node != null && node !== list) {
                node.forceLayout()
                node = node.parent as? View
            }
            list.forceLayout()
            list.measure(
                View.MeasureSpec.makeMeasureSpec(list.width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(list.height, View.MeasureSpec.EXACTLY),
            )
            list.layout(list.left, list.top, list.right, list.bottom)
        }
    }

    private fun outermostList(view: View): View? {
        var current = view.parent as? View
        var outer: View? = null
        repeat(MAX_ANCESTOR_DEPTH) {
            val node = current ?: return outer
            if (isRecycler(node)) outer = node
            current = node.parent as? View
        }
        return outer
    }

    fun refresh(rendered: String) {
        val views = synchronized(lock) { shown.entries.filter { rendered in it.value }.map { it.key } }
        views.forEach { reapply(it) }
    }

    fun refreshAll() {
        val views = synchronized(lock) { originals.keys.toList() }
        views.forEach { reapply(it) }
    }

    fun describe(): String = synchronized(lock) {
        JSONObject()
            .put("rules", rules.size)
            .put("shown", shown.size)
            .put(
                "groups",
                JSONArray(
                    groupsById.values.map { group ->
                        val owner = group.owner?.get()
                        JSONObject()
                            .put("id", group.id)
                            .put("rendered", group.rendered.take(24))
                            .put("owner", owner != null)
                            .put("ownerShows", owner != null && shown[owner]?.contains(group.rendered) == true)
                            .put(
                                "hosts",
                                JSONArray(
                                    group.slots.map { slot ->
                                        JSONObject()
                                            .put("parent", slot.host.parent?.javaClass?.simpleName)
                                            .put("attached", slot.host.isAttachedToWindow)
                                            .put("visible", slot.host.visibility == View.VISIBLE)
                                            .put("children", (slot.host as? ViewGroup)?.childCount ?: 0)
                                            .put("frame", "${slot.host.x.toInt()},${slot.host.y.toInt()} ${slot.host.width}x${slot.host.height}")
                                            .put("content", describeContent((slot.host as? ViewGroup)?.getChildAt(0)))
                                    },
                                ),
                            )
                    },
                ),
            )
            .toString()
    }

    private fun describeContent(view: View?, depth: Int = 0): String? {
        view ?: return null
        val group = view as? ViewGroup
        val children = group?.childCount ?: 0
        val requested = if (view.isLayoutRequested) "*" else ""
        val own = "${view.javaClass.simpleName} ${view.width}x${view.height}$requested children=$children"
        if (group == null || depth >= DESCRIBE_DEPTH) return own
        val nested = (0 until children).mapNotNull { describeContent(group.getChildAt(it), depth + 1) }
        return if (nested.isEmpty()) own else "$own [${nested.joinToString("; ")}]"
    }

    fun needsHost(view: TextView, rendered: String) {
        lastEvent = rendered
    }

    private fun isWatched(view: TextView): Boolean {
        val names = synchronized(lock) { if (watched.isEmpty()) return false else watched.toSet() }
        var current: Class<*>? = view.javaClass
        while (current != null && current != TextView::class.java) {
            if (current.name in names) return true
            current = current.superclass
        }
        return false
    }

    private fun rewrite(view: TextView, text: CharSequence?, stages: MutableSet<String>): CharSequence? {
        if (text == null) {
            synchronized(lock) { originals.remove(view) }
            return null
        }
        var current: CharSequence = text
        stages.add(current.toString())

        var steps = 0
        while (steps++ < MAX_CHAIN) {
            val rule = synchronized(lock) { rules[current.toString()] } ?: break
            current = apply(current, rule) ?: break
            stages.add(current.toString())
        }

        synchronized(lock) {
            if (current !== text) originals[view] = text else originals.remove(view)
        }
        return current
    }

    private fun apply(text: CharSequence, rule: Rule): CharSequence? {
        val builder = SpannableStringBuilder(text)
        for (edit in rule.edits) {
            if (edit.end > builder.length || edit.start > edit.end) return null
            clearSpans(builder, edit.clearFrom, edit.clearTo)
            val stretched = stretchedSpans(builder, edit)
            builder.replace(edit.start, edit.end, edit.text)
            if (edit.imageKey != null && !insertImage(builder, edit)) return null
            if (stretched.isNotEmpty()) restretch(builder, edit, stretched)
            val spacer = edit.start + edit.spacerOffset
            if (edit.spacerOffset >= 0 && spacer < builder.length && builder[spacer] == PLACEHOLDER) {
                builder.setSpan(spacerSpan(edit.width, edit.height), spacer, spacer + 1, SPAN_EXCLUSIVE_EXCLUSIVE)
                if (edit.collapseNext && spacer + 2 <= builder.length && builder[spacer + 1] == '\n') {
                    builder.setSpan(AbsoluteSizeSpan(1), spacer + 1, spacer + 2, SPAN_EXCLUSIVE_EXCLUSIVE)
                }
            }
        }
        return if (builder.toString() == rule.rendered) builder else null
    }

    private class Stretched(val span: Any, val flags: Int, val stretch: Boolean)

    private fun stretchedSpans(builder: SpannableStringBuilder, edit: Edit): List<Stretched> {
        if (edit.stretchClasses.isEmpty() || edit.stretchTo <= edit.stretchFrom) return emptyList()
        return builder.getSpans(edit.stretchFrom, edit.stretchTo, Any::class.java)
            .filter { builder.getSpanStart(it) < edit.stretchTo && builder.getSpanEnd(it) > edit.stretchFrom }
            .map { span -> Stretched(span, builder.getSpanFlags(span), isA(span, edit.stretchClasses)) }
    }

    private fun isA(span: Any, names: Set<String>): Boolean {
        var current: Class<*>? = span.javaClass
        while (current != null) {
            if (current.name in names) return true
            current = current.superclass
        }
        return false
    }

    private fun restretch(builder: SpannableStringBuilder, edit: Edit, spans: List<Stretched>) {
        val grown = edit.text.length - (edit.end - edit.start)
        for (entry in spans) {
            val start = if (entry.stretch) edit.stretchFrom else builder.getSpanStart(entry.span)
            val end = if (entry.stretch) edit.stretchTo + grown else builder.getSpanEnd(entry.span)
            builder.removeSpan(entry.span)
            if (start >= 0 && end > start) builder.setSpan(entry.span, start, end, entry.flags)
        }
    }

    private fun insertImage(builder: SpannableStringBuilder, edit: Edit): Boolean {
        val bitmap = synchronized(lock) { images[edit.imageKey] } ?: return false
        val index = edit.start + edit.imageOffset
        if (index < 0 || index >= builder.length) return false
        val drawable = BitmapDrawable(null, bitmap).apply { setBounds(0, 0, edit.imageSize, edit.imageSize) }
        builder.setSpan(ImageSpan(drawable, ALIGN_CENTER), index, index + 1, SPAN_EXCLUSIVE_EXCLUSIVE)
        return true
    }

    private fun clearSpans(builder: SpannableStringBuilder, from: Int, to: Int) {
        if (from < 0 || to <= from) return
        for (span in builder.getSpans(from, to, Any::class.java)) {
            if (builder.getSpanStart(span) >= from && builder.getSpanEnd(span) <= to) builder.removeSpan(span)
        }
    }

    private fun spacerSpan(width: Int, height: Int): ImageSpan {
        val drawable = ColorDrawable(Color.TRANSPARENT).apply { setBounds(0, 0, width, height) }
        return ImageSpan(drawable, ImageSpan.ALIGN_BOTTOM)
    }

    private fun listen(view: TextView) {
        if (synchronized(lock) { listening.put(view, true) } == true) return
        view.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(attached: View) {
                val stages = synchronized(lock) { shown[view] } ?: return
                runCatching { onTextShown(view, stages) }
                    .onFailure { Logger.error("plugins", "Text rewrite hosts failed", it) }
            }

            override fun onViewDetachedFromWindow(detached: View) = Unit
        })
        view.addOnLayoutChangeListener { _, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
            if (left != oldLeft || top != oldTop || right != oldRight || bottom != oldBottom) positionAll(view)
        }
    }

    private fun onTextShown(view: TextView, stages: Set<String>) {
        val (owned, wanted) = synchronized(lock) {
            shown[view] = stages
            val owned = groupsById.values.filter { it.owner?.get() === view }
            owned to stages.filter { it in renderedTexts }
        }

        for (group in owned) {
            if (group.rendered !in stages) release(group)
        }

        if (wanted.isNotEmpty()) listen(view)

        for (rendered in wanted) {
            if (owned.any { it.rendered == rendered }) continue
            val group = synchronized(lock) { groups[rendered]?.firstOrNull { isFree(it) } }
            if (group != null) {
                attach(group, view)
            } else if (synchronized(lock) { groups[rendered]?.isNotEmpty() == true }) {
                needsHost(view, rendered)
            }
        }

        if (owned.any { it.rendered in stages } || wanted.isNotEmpty()) schedulePosition(view)
    }

    private fun ownsShown(group: Group, view: TextView): Boolean = synchronized(lock) {
        group.owner?.get() === view && shown[view]?.contains(group.rendered) == true
    }

    private fun isFree(group: Group): Boolean {
        val owner = group.owner?.get() ?: return true
        return !owner.isAttachedToWindow || shown[owner]?.contains(group.rendered) != true
    }

    private fun claimFor(rendered: String) {
        val views = synchronized(lock) { shown.entries.filter { rendered in it.value }.map { it.key } }
        for (view in views) {
            val owns = synchronized(lock) { groups[rendered]?.any { it.owner?.get() === view } == true }
            if (owns) {
                schedulePosition(view)
                continue
            }
            val group = synchronized(lock) { groups[rendered]?.firstOrNull { isFree(it) } } ?: continue
            attach(group, view)
        }
    }

    private fun release(group: Group) {
        group.owner = null
        for (slot in group.slots) {
            if (slot.host.visibility != View.GONE) slot.host.visibility = View.GONE
        }
    }

    private fun attach(group: Group, view: TextView) {
        synchronized(lock) { group.owner = WeakReference(view) }
        for (slot in group.slots) {
            if (slot.host.visibility != View.GONE) slot.host.visibility = View.GONE
        }
        val container = container(view)
        if (container == null) {
            view.post { if (ownsShown(group, view)) attach(group, view) }
            return
        }
        for (slot in group.slots) {
            val host = slot.host
            if (host.parent !== container) {
                (host.parent as? ViewGroup)?.removeView(host)
                container.addView(host, ViewGroup.LayoutParams(slot.anchor.width, slot.anchor.height))
            }
        }
        schedulePosition(view)
    }

    private fun container(view: View): ViewGroup? {
        var current: View = view
        repeat(MAX_ANCESTOR_DEPTH) {
            val parent = current.parent as? ViewGroup ?: return null
            if (!isRecycler(parent)) return parent
            current = parent
        }
        return null
    }

    private fun isRecycler(view: View): Boolean {
        var current: Class<*>? = view.javaClass
        while (current != null) {
            if (current.name == RECYCLER_VIEW) return true
            current = current.superclass
        }
        return false
    }

    private fun schedulePosition(view: TextView) {
        if (synchronized(lock) { pendingLayout.put(view, true) } == true) return
        val observer = view.viewTreeObserver
        if (!observer.isAlive) {
            synchronized(lock) { pendingLayout.remove(view) }
            return
        }
        observer.addOnPreDrawListener(object : ViewTreeObserver.OnPreDrawListener {
            override fun onPreDraw(): Boolean {
                if (view.viewTreeObserver.isAlive) view.viewTreeObserver.removeOnPreDrawListener(this)
                synchronized(lock) { pendingLayout.remove(view) }
                positionAll(view)
                return true
            }
        })
        view.invalidate()
    }

    private fun positionAll(view: TextView) {
        val owned = synchronized(lock) {
            groupsById.values.filter { it.owner?.get() === view && shown[view]?.contains(it.rendered) == true }
        }
        var empty = false
        for (group in owned) {
            for (slot in group.slots) {
                if (position(view, slot) && slot.host.visibility != View.VISIBLE) {
                    slot.host.visibility = View.VISIBLE
                }
                empty = empty || hasEmptyContent(slot.host)
            }
        }
        if (empty) retryEmptyContent(view) else synchronized(lock) { contentRetries.remove(view) }
    }

    private fun hasEmptyContent(host: View): Boolean {
        val content = (host as? ViewGroup)?.getChildAt(0) as? ViewGroup ?: return false
        return host.isAttachedToWindow && content.childCount == 0
    }

    private fun retryEmptyContent(view: TextView) {
        val attempts = synchronized(lock) { (contentRetries[view] ?: 0) + 1 }
        if (attempts > MAX_CONTENT_RETRIES) return
        synchronized(lock) { contentRetries[view] = attempts }
        view.postDelayed({ if (view.isAttachedToWindow) positionAll(view) }, CONTENT_RETRY_DELAY_MS)
    }

    private fun position(view: TextView, slot: Slot): Boolean {
        val layout = view.layout ?: return false
        val host = slot.host
        val container = host.parent as? ViewGroup ?: return false
        val anchor = slot.anchor
        if (anchor.placeholder >= view.text.length) return false

        var x = 0f
        var y = 0f
        var current: View = view
        while (current !== container) {
            x += current.left - current.scrollX
            y += current.top - current.scrollY
            current = current.parent as? View ?: return false
        }

        val line = layout.getLineForOffset(anchor.placeholder)
        val lineY = if (anchor.pinTop) layout.getLineTop(line) else layout.getLineBottom(line) - anchor.height
        host.translationX = x + layout.getPrimaryHorizontal(anchor.placeholder) + view.totalPaddingLeft
        host.translationY = y + lineY + view.totalPaddingTop + anchor.offsetY

        val params = host.layoutParams
        if (params != null && (params.width != anchor.width || params.height != anchor.height)) {
            params.width = anchor.width
            params.height = anchor.height
            host.layoutParams = params
        }
        val widthSpec = View.MeasureSpec.makeMeasureSpec(anchor.width, View.MeasureSpec.EXACTLY)
        val heightSpec = View.MeasureSpec.makeMeasureSpec(anchor.height, View.MeasureSpec.EXACTLY)
        host.measure(widthSpec, heightSpec)
        host.layout(0, 0, anchor.width, anchor.height)
        if (host is ViewGroup) {
            for (index in 0 until host.childCount) {
                val child = host.getChildAt(index)
                if ((child as? ViewGroup)?.childCount == 0) child.forceLayout()
                child.measure(widthSpec, heightSpec)
                child.layout(0, 0, anchor.width, anchor.height)
            }
        }
        return true
    }

    private fun parseAnchor(json: String): Anchor {
        val anchor = JSONObject(json)
        return Anchor(
            placeholder = anchor.getInt("placeholder"),
            width = anchor.getInt("width"),
            height = anchor.getInt("height"),
            pinTop = anchor.optBoolean("pinTop", false),
            offsetY = anchor.optInt("offsetY", 0),
        )
    }

    private fun parseEdits(json: String): List<Edit> {
        val array = JSONArray(json)
        return List(array.length()) { index ->
            val edit = array.getJSONObject(index)
            Edit(
                start = edit.getInt("start"),
                end = edit.getInt("end"),
                text = edit.getString("text"),
                spacerOffset = edit.optInt("spacerOffset", -1),
                width = edit.optInt("width", 0),
                height = edit.optInt("height", 0),
                clearFrom = edit.optInt("clearFrom", -1),
                clearTo = edit.optInt("clearTo", -1),
                collapseNext = edit.optBoolean("collapseNext", false),
                imageKey = edit.optString("imageKey").takeIf { it.isNotEmpty() },
                imageOffset = edit.optInt("imageOffset", 0),
                imageSize = edit.optInt("imageSize", 0),
                stretchFrom = edit.optInt("stretchFrom", -1),
                stretchTo = edit.optInt("stretchTo", -1),
                stretchClasses = edit.optJSONArray("stretchClasses")?.let { classes ->
                    List(classes.length()) { classes.getString(it) }.toSet()
                } ?: emptySet(),
            )
        }
    }
}
