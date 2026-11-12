package app.unbound.android

import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.text.Spannable
import android.text.Spanned
import android.text.TextPaint
import android.text.style.LineHeightSpan
import android.text.style.MetricAffectingSpan
import android.text.style.ReplacementSpan
import android.view.View
import android.widget.TextView
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import java.lang.reflect.Field
import java.lang.reflect.Method
import java.lang.reflect.Proxy
import java.util.Collections
import java.util.WeakHashMap
import kotlin.math.max

/**
 * A replacement font can be taller than the line box Discord's text styles fix, and React Native
 * clips each text view to its box. Each line is centred on its own ink instead, and a text view
 * whose ink reaches past its box draws past it.
 */
object FontOverflow {
    private val MANAGER = HostClass.legacy("com.facebook.react.views.text.ReactTextViewManager")
    private const val CALLBACK = "reactTextViewManagerCallback"
    private const val VISIBLE = "visible"

    // Discord's `overflow` per text view, and the views given a shadow to draw past their box. Main thread only.
    private val requested = WeakHashMap<View, String?>()
    private val shadowed = Collections.newSetFromMap(WeakHashMap<TextView, Boolean>())

    /** Ink of a run of text from its baseline, in pixels. */
    internal data class Ink(val top: Int, val bottom: Int, val side: Int)

    /**
     * The baseline, from the top of a `box`-tall line, that centres ink reaching `top` above it and
     * `bottom` below; `null` when the ink already fits around `baseline`.
     */
    internal fun centredBaseline(box: Int, baseline: Int, top: Int, bottom: Int): Int? =
        if (top <= baseline && bottom <= box - baseline) null else (box + top - bottom) / 2

    /** How far `ink` reaches past a `box`-tall line once centred, or past a letter's advance. */
    internal fun overhang(box: Int, baseline: Int, ink: Ink): Int {
        val centred = centredBaseline(box, baseline, ink.top, ink.bottom) ?: baseline
        return maxOf(ink.top - centred, ink.bottom - (box - centred), ink.side, 0)
    }

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        val manager = MANAGER.find(classLoader) ?: return
        val callback = runCatching { manager.getDeclaredField(CALLBACK).apply { isAccessible = true } }.getOrNull()
        val setOverflow = manager.declaredMethods.firstOrNull { it.name == "setOverflow" && it.parameterTypes.size == 2 }
        val updateExtraData = manager.declaredMethods.firstOrNull { it.name == "updateExtraData" && it.parameterTypes.size == 2 }
        if (callback == null || setOverflow == null || updateExtraData == null) {
            Logger.warning(LogCategory.FONTS, "React Native's text manager changed; tall fonts may be clipped.")
            return
        }

        for (constructor in manager.declaredConstructors) {
            xposed.hook(constructor)
                .setExceptionMode(ExceptionMode.PROTECTIVE)
                .intercept { chain -> chain.proceed().also { wrapCallback(chain.thisObject, callback) } }
        }
        xposed.hook(setOverflow)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val view = chain.getArg(0) as? TextView ?: return@intercept chain.proceed()
                val overflow = chain.getArg(1) as String?
                requested[view] = overflow
                chain.proceed(arrayOf(view, if (overhangOf(view) > 0) VISIBLE else overflow))
            }
        xposed.hook(updateExtraData)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                chain.proceed().also {
                    val view = chain.getArg(0) as? TextView ?: return@also
                    refresh(chain.thisObject, setOverflow, view)
                }
            }
        Logger.info(LogCategory.FONTS, "Hooked React Native's text views for tall fonts.")
    }

    /** Wraps the manager's spannable post-processor, so every text it sets gets a centring span. */
    private fun wrapCallback(manager: Any, field: Field) {
        val original = field.get(manager)
        val proxy = Proxy.newProxyInstance(field.type.classLoader, arrayOf(field.type)) { self, method, args ->
            when (method.name) {
                "equals" -> self === args?.firstOrNull()

                "hashCode" -> System.identityHashCode(self)

                "toString" -> "UnboundFontOverflow"

                else -> {
                    val text = args?.singleOrNull() as? Spannable
                    if (text != null) {
                        runCatching { centre(text) }
                            .onFailure { Logger.error(LogCategory.FONTS, "Failed to centre text in its line box", it) }
                    }
                    original?.let { method.invoke(it, *(args ?: emptyArray())) }
                }
            }
        }
        field.set(manager, proxy)
    }

    private fun centre(text: Spannable) {
        for (span in text.getSpans(0, text.length, CentredLineHeight::class.java)) text.removeSpan(span)
        if (!Fonts.active || text.isEmpty()) return
        var overhang = 0
        runs(text, 0, text.length) { paint, start, end ->
            val metrics = paint.fontMetricsInt
            for (span in text.getSpans(start, end, LineHeightSpan::class.java)) {
                span.chooseHeight(text, start, end, 0, 0, metrics)
            }
            val ink = inkOf(text, start, end, paint)
            overhang = max(overhang, overhang(metrics.descent - metrics.ascent, -metrics.ascent, ink))
        }
        // Added last, so it runs after React Native's own line height span has fixed the box.
        text.setSpan(CentredLineHeight(overhang), 0, text.length, Spanned.SPAN_INCLUSIVE_INCLUSIVE)
    }

    /** Re-applies Discord's `overflow` and the view's shadow for the text it now shows. */
    private fun refresh(manager: Any, setOverflow: Method, view: TextView) {
        if (requested.containsKey(view)) setOverflow.invoke(manager, view, requested[view])
        val overhang = overhangOf(view)
        val ours = view in shadowed
        // `TextView` clips its drawing to its box widened by its shadow, so a transparent one lets the ink out.
        if (overhang > 0 && (ours || view.shadowRadius == 0f)) {
            view.setShadowLayer(overhang + 1f, 0f, 0f, Color.TRANSPARENT)
            shadowed.add(view)
        } else if (overhang == 0 && ours) {
            view.setShadowLayer(0f, 0f, 0f, Color.TRANSPARENT)
            shadowed.remove(view)
        }
    }

    private fun overhangOf(view: TextView): Int {
        val text = view.text as? Spanned ?: return 0
        return text.getSpans(0, text.length, CentredLineHeight::class.java).maxOfOrNull { it.overhang } ?: 0
    }

    /** Calls `each` with the paint of every run of `text` in `start..end` drawn as text, not as an image. */
    private inline fun runs(text: Spanned, start: Int, end: Int, each: (TextPaint, Int, Int) -> Unit) {
        var from = start
        while (from < end) {
            val to = text.nextSpanTransition(from, end, MetricAffectingSpan::class.java)
            if (text.getSpans(from, to, ReplacementSpan::class.java).isEmpty()) {
                val paint = TextPaint()
                for (span in text.getSpans(from, to, MetricAffectingSpan::class.java)) span.updateMeasureState(paint)
                each(paint, from, to)
            }
            from = to
        }
    }

    private fun inkOf(text: CharSequence, start: Int, end: Int, paint: TextPaint): Ink {
        val run = text.subSequence(start, end).toString()
        val bounds = Rect()
        paint.getTextBounds(run, 0, run.length, bounds)
        if (bounds.isEmpty) return Ink(0, 0, 0)
        val side = max(-bounds.left, bounds.right - paint.measureText(run).toInt())
        return Ink(-bounds.top, bounds.bottom, side)
    }

    /** Centres each line on its own ink when the ink is taller than the line box. */
    private class CentredLineHeight(val overhang: Int) : LineHeightSpan {
        override fun chooseHeight(text: CharSequence, start: Int, end: Int, spanstartv: Int, lineHeight: Int, fm: Paint.FontMetricsInt) {
            val spanned = text as? Spanned ?: return
            var top = 0
            var bottom = 0
            runs(spanned, start, end) { paint, from, to ->
                val ink = inkOf(spanned, from, to, paint)
                top = max(top, ink.top)
                bottom = max(bottom, ink.bottom)
            }
            val box = fm.descent - fm.ascent
            val baseline = centredBaseline(box, -fm.ascent, top, bottom) ?: return
            fm.ascent = -baseline
            fm.descent = box - baseline
            fm.top = fm.ascent
            fm.bottom = fm.descent
        }
    }
}
