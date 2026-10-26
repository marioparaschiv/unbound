package app.unbound.android

import android.content.Context
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Rect
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.widget.TextView
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import java.util.Collections
import java.util.WeakHashMap
import kotlin.math.ceil

object ChatUI {
    private const val CLIPPING_UTILS = "com.discord.misc.utilities.view.ViewClippingUtilsKt"
    private const val MESSAGE_VIEW = "com.discord.chat.presentation.message.MessageView"
    private const val ACCESSORIES_VIEW = "com.discord.chat.presentation.message.MessageAccessoriesView"
    private const val CONTENT_VIEW = "com.discord.chat.presentation.message.view.MessageContentView"
    private const val AVATAR_VIEW = "com.facebook.drawee.view.SimpleDraweeView"
    private const val THEME_MANAGER = "com.discord.theme.ThemeManager"
    private const val PROBE_SIZE = 100

    private data class BubbleStyle(
        val radius: Float,
        val horizontalPadding: Float,
        val verticalPadding: Float,
        val darkColor: Int,
        val lightColor: Int,
    )

    private val main = Handler(Looper.getMainLooper())
    private val avatars = Collections.synchronizedMap(WeakHashMap<View, ViewOutlineProvider>())
    private val bubbles = Collections.synchronizedMap(WeakHashMap<ViewGroup, View>())
    private val rowBackgrounds = WeakHashMap<ViewGroup, Drawable>()
    private val circleProviders = Collections.synchronizedMap(WeakHashMap<ViewOutlineProvider, Boolean>())

    @Volatile private var avatarRadius: Float? = null

    @Volatile private var bubblesEnabled = false

    @Volatile private var style: BubbleStyle? = null
    private var themeManager: Any? = null
    private var isThemeDark: java.lang.reflect.Method? = null

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        reload()
        loadTheme(classLoader)
        hookAvatars(xposed, classLoader)
        hookMessageViews(xposed, classLoader)
        Logger.info(LogCategory.CHATUI, "Hooked avatars and message rows.")
    }

    fun reload() {
        avatarRadius = NativeBridge.nativePreference("avatar-radius", null)?.toFloatOrNull()
        bubblesEnabled = NativeBridge.preferenceEnabled("message-bubbles")
        style = readStyle()
        main.post {
            synchronized(avatars) { avatars.keys.toList() }.forEach(::applyAvatar)
            synchronized(bubbles) { bubbles.entries.toList() }.forEach { (row, bubble) -> placeBubble(row, bubble) }
        }
    }

    private fun readStyle(): BubbleStyle? = runCatching {
        val values = NativeBridge.nativeMessageBubbleStyle()
        BubbleStyle(
            values[0].toFloat(),
            values[1].toFloat(),
            values[2].toFloat(),
            values[3].toLong().toInt(),
            values[4].toLong().toInt(),
        )
    }.getOrNull()

    private fun loadTheme(classLoader: ClassLoader) {
        val type = runCatching { classLoader.loadClass(THEME_MANAGER) }.getOrNull()
        if (type == null) {
            Logger.info(LogCategory.CHATUI, "Discord's theme manager is obfuscated, so bubbles follow the message text colour.")
            return
        }
        runCatching {
            themeManager = type.getField("INSTANCE").get(null)
            isThemeDark = type.getMethod("isThemeDark")
        }.onFailure { Logger.error(LogCategory.CHATUI, "Discord's theme manager is unavailable", it) }
    }

    private fun darkTheme(row: ViewGroup): Boolean {
        isThemeDark?.let { method ->
            runCatching { method.invoke(themeManager) as? Boolean }.getOrNull()?.let { return it }
        }
        val text = contentText(row) ?: return true
        return Color.luminance(text.currentTextColor) > 0.5f
    }

    private fun contentText(group: ViewGroup): TextView? {
        for (child in children(group)) {
            if (child is TextView && child.javaClass.name == CONTENT_VIEW) return child
            if (child is ViewGroup) contentText(child)?.let { return it }
        }
        return null
    }

    private fun hookAvatars(xposed: XposedInterface, classLoader: ClassLoader) {
        val avatarType = classLoader.loadClass(AVATAR_VIEW)
        val clipToCircle = runCatching {
            classLoader.loadClass(CLIPPING_UTILS).getDeclaredMethod("clipToCircle", View::class.java)
        }.getOrNull()
        if (clipToCircle == null) {
            hookCircleOutlines(xposed, avatarType)
            return
        }
        xposed.hook(clipToCircle)
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val result = chain.proceed()
                val view = chain.getArg(0) as? View
                if (view != null && avatarType.isInstance(view)) {
                    avatars[view] = view.outlineProvider
                    applyAvatar(view)
                }
                result
            }
    }

    private fun hookCircleOutlines(xposed: XposedInterface, avatarType: Class<*>) {
        xposed.hook(View::class.java.getDeclaredMethod("setOutlineProvider", ViewOutlineProvider::class.java))
            .setExceptionMode(ExceptionMode.PROTECTIVE)
            .intercept { chain ->
                val result = chain.proceed()
                val view = chain.thisObject as View
                val provider = chain.getArg(0) as? ViewOutlineProvider
                if (provider != null &&
                    provider !is RoundedOutline &&
                    avatars[view] !== provider &&
                    avatarType.isInstance(view) &&
                    isCircle(provider, view.context)
                ) {
                    avatars[view] = provider
                    applyAvatar(view)
                }
                result
            }
    }

    private fun isCircle(provider: ViewOutlineProvider, context: Context): Boolean = circleProviders.getOrPut(provider) {
        runCatching {
            val probe = View(context).apply { layout(0, 0, PROBE_SIZE, PROBE_SIZE) }
            val outline = Outline()
            provider.getOutline(probe, outline)
            val bounds = Rect()
            outline.getRect(bounds) && bounds.width() == PROBE_SIZE && bounds.height() == PROBE_SIZE && outline.radius == PROBE_SIZE / 2f
        }.getOrDefault(false)
    }

    private fun applyAvatar(view: View) {
        val radius = avatarRadius
        val original = avatars[view] ?: return
        view.outlineProvider = if (radius == null) original else roundedOutline(dp(view, radius))
        view.clipToOutline = true
        view.invalidateOutline()
    }

    private fun roundedOutline(radius: Float) = RoundedOutline(radius)

    private class RoundedOutline(private val radius: Float) : ViewOutlineProvider() {
        override fun getOutline(view: View, outline: Outline) {
            outline.setRoundRect(0, 0, view.width, view.height, radius)
        }
    }

    private fun hookMessageViews(xposed: XposedInterface, classLoader: ClassLoader) {
        val type = classLoader.loadClass(MESSAGE_VIEW)
        for (constructor in type.declaredConstructors) {
            xposed.hook(constructor)
                .setExceptionMode(ExceptionMode.PROTECTIVE)
                .intercept { chain ->
                    val result = chain.proceed()
                    (chain.thisObject as? ViewGroup)?.let(::attachBubble)
                    result
                }
        }
    }

    private fun attachBubble(row: ViewGroup) {
        if (bubbles.containsKey(row)) return

        val bubble = View(row.context).apply {
            isClickable = false
            isFocusable = false
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            visibility = View.GONE
        }
        row.addView(bubble, 0, ViewGroup.LayoutParams(0, 0))
        bubbles[row] = bubble
        row.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> placeBubble(row, bubble) }
    }

    private fun placeBubble(row: ViewGroup, bubble: View) {
        val current = style
        val enabled = bubblesEnabled && current != null
        if (enabled) clearRowBackground(row) else restoreRowBackground(row)

        val area = if (enabled) contentArea(row) else null
        if (area == null || current == null) {
            if (bubble.visibility != View.GONE) bubble.visibility = View.GONE
            return
        }

        area.inset(-dp(row, current.horizontalPadding).toInt(), -dp(row, current.verticalPadding).toInt())
        val background = (bubble.background as? GradientDrawable) ?: GradientDrawable().also { bubble.background = it }
        background.cornerRadius = dp(row, current.radius)
        background.setColor(if (darkTheme(row)) current.darkColor else current.lightColor)
        if (bubble.visibility != View.VISIBLE) bubble.visibility = View.VISIBLE
        bubble.measure(
            View.MeasureSpec.makeMeasureSpec(area.width(), View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(area.height(), View.MeasureSpec.EXACTLY),
        )
        bubble.layout(area.left, area.top, area.right, area.bottom)
    }

    private fun clearRowBackground(row: ViewGroup) {
        val background = row.background ?: return
        rowBackgrounds[row] = background
        row.background = null
    }

    private fun restoreRowBackground(row: ViewGroup) {
        val background = rowBackgrounds.remove(row) ?: return
        if (row.background == null) row.background = background
    }

    private fun contentArea(row: ViewGroup): Rect? {
        val accessories = children(row).firstOrNull { it.javaClass.name == ACCESSORIES_VIEW } as? ViewGroup ?: return null
        val visible = children(accessories).filter { it.visibility == View.VISIBLE && it.width > 0 && it.height > 0 }
        if (visible.isEmpty()) return null

        val area = Rect()
        for (child in visible) {
            val bounds = Rect(child.left, child.top, child.right, child.bottom)
            if (visible.size == 1 && child.javaClass.name == CONTENT_VIEW && child is TextView) {
                bounds.right = bounds.left + textWidth(child).coerceAtMost(child.width)
            }
            area.union(bounds)
        }
        area.offset(accessories.left, accessories.top)
        return area.takeIf { !it.isEmpty }
    }

    private fun textWidth(view: TextView): Int {
        val layout = view.layout ?: return view.width
        var widest = 0f
        for (line in 0 until layout.lineCount) widest = maxOf(widest, layout.getLineWidth(line))
        return ceil(widest).toInt() + view.totalPaddingLeft + view.totalPaddingRight
    }

    private fun children(group: ViewGroup): List<View> = (0 until group.childCount).map(group::getChildAt)

    private fun dp(view: View, value: Float): Float = value * view.resources.displayMetrics.density
}
