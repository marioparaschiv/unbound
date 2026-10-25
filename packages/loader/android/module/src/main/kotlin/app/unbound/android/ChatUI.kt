package app.unbound.android

import android.graphics.Color
import android.graphics.Outline
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.widget.TextView
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import org.json.JSONObject
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

    @Volatile private var avatarRadius: Float? = null
    @Volatile private var bubblesEnabled = false
    @Volatile private var style = BubbleStyle(10f, 8f, 4f, Color.argb(102, 0, 0, 0), Color.argb(102, 255, 255, 255))
    private var themeManager: Any? = null
    private var isThemeDark: java.lang.reflect.Method? = null

    fun install(xposed: XposedInterface, classLoader: ClassLoader) {
        reload()
        loadTheme(classLoader)
        hookAvatars(xposed, classLoader)
        hookMessageViews(xposed, classLoader)
        Logger.info("chatui", "Hooked avatars and message rows.")
    }

    fun reload() {
        avatarRadius = NativeBridge.nativePreference("avatar-radius", null)?.toFloatOrNull()
        bubblesEnabled = NativeBridge.preferenceEnabled("message-bubbles")
        style = readStyle() ?: style
        main.post {
            synchronized(avatars) { avatars.keys.toList() }.forEach(::applyAvatar)
            synchronized(bubbles) { bubbles.entries.toList() }.forEach { (row, bubble) -> placeBubble(row, bubble) }
        }
    }

    private fun readStyle(): BubbleStyle? = runCatching {
        val json = JSONObject(NativeBridge.nativePreference("bubble-style", null).orEmpty())
        BubbleStyle(
            json.getDouble("radius").toFloat(),
            json.getDouble("horizontalPadding").toFloat(),
            json.getDouble("verticalPadding").toFloat(),
            NativeBridge.nativeColor(json.getString("darkColor")),
            NativeBridge.nativeColor(json.getString("lightColor")),
        )
    }.getOrNull()

    private fun loadTheme(classLoader: ClassLoader) {
        runCatching {
            val type = classLoader.loadClass(THEME_MANAGER)
            themeManager = type.getField("INSTANCE").get(null)
            isThemeDark = type.getMethod("isThemeDark")
        }.onFailure { Logger.error("chatui", "Discord's theme manager is unavailable", it) }
    }

    private fun darkTheme(): Boolean =
        runCatching { isThemeDark?.invoke(themeManager) as? Boolean }.getOrNull() ?: true

    private fun hookAvatars(xposed: XposedInterface, classLoader: ClassLoader) {
        val avatarType = classLoader.loadClass(AVATAR_VIEW)
        val clipToCircle = classLoader.loadClass(CLIPPING_UTILS).getDeclaredMethod("clipToCircle", View::class.java)
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

    private fun applyAvatar(view: View) {
        val radius = avatarRadius
        val original = avatars[view] ?: return
        view.outlineProvider = if (radius == null) original else roundedOutline(dp(view, radius))
        view.clipToOutline = true
        view.invalidateOutline()
    }

    private fun roundedOutline(radius: Float) = object : ViewOutlineProvider() {
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
        val area = if (bubblesEnabled) contentArea(row) else null
        if (area == null) {
            if (bubble.visibility != View.GONE) bubble.visibility = View.GONE
            return
        }

        val current = style
        area.inset(-dp(row, current.horizontalPadding).toInt(), -dp(row, current.verticalPadding).toInt())
        val background = (bubble.background as? GradientDrawable) ?: GradientDrawable().also { bubble.background = it }
        background.cornerRadius = dp(row, current.radius)
        background.setColor(if (darkTheme()) current.darkColor else current.lightColor)
        if (bubble.visibility != View.VISIBLE) bubble.visibility = View.VISIBLE
        bubble.measure(
            View.MeasureSpec.makeMeasureSpec(area.width(), View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(area.height(), View.MeasureSpec.EXACTLY),
        )
        bubble.layout(area.left, area.top, area.right, area.bottom)
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
