package app.unbound.android

import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.LauncherActivityInfo
import android.content.pm.LauncherApps
import android.content.pm.PackageManager
import android.content.pm.ShortcutInfo
import android.content.res.Resources
import android.graphics.Bitmap
import android.graphics.drawable.Drawable
import android.os.Handler
import android.os.Looper
import android.os.UserHandle
import android.view.View
import android.widget.TextView
import io.github.libxposed.api.XposedInterface
import io.github.libxposed.api.XposedInterface.ExceptionMode
import java.util.Collections
import java.util.WeakHashMap
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

internal object LauncherIconHook {
    val LAUNCHERS = LauncherPackages.HOOKED
    private const val DISCORD = Unbound.DISCORD_PACKAGE
    private const val RECONCILE_DELAY_MS = 2_000L

    private val discordResources: MutableSet<Resources> = Collections.synchronizedSet(
        Collections.newSetFromMap(WeakHashMap()),
    )
    private val launcherCallbacks = CopyOnWriteArrayList<Pair<LauncherApps.Callback, Handler?>>()
    private val icons = ConcurrentHashMap<Int, Drawable>()
    private val ownQuery = ThreadLocal<Boolean>()

    @Volatile private var iconIds: Set<Int>? = null

    @Volatile private var shortcutStamp: Long? = null

    @Volatile private var observing = false

    @Volatile private var animatedSelected: Boolean? = null

    @Volatile private var moduleAPK: String? = null

    private var animation: Pair<List<Bitmap>, AnimatedIconTiming>? = null
    private var animationFailed = false
    private val discordViews: MutableMap<View, Boolean> = Collections.synchronizedMap(WeakHashMap())

    private val observer = object : LauncherApps.Callback() {
        override fun onPackageRemoved(packageName: String, user: UserHandle) = Unit
        override fun onPackageAdded(packageName: String, user: UserHandle) = Unit
        override fun onPackageChanged(packageName: String, user: UserHandle) {
            if (packageName == DISCORD) iconIds = null
        }
        override fun onPackagesAvailable(packageNames: Array<out String>, user: UserHandle, replacing: Boolean) = Unit
        override fun onPackagesUnavailable(packageNames: Array<out String>, user: UserHandle, replacing: Boolean) = Unit
        override fun onShortcutsChanged(packageName: String, shortcuts: MutableList<ShortcutInfo>, user: UserHandle) {
            if (packageName != DISCORD) return
            val stamp = shortcuts.firstOrNull { it.id == LauncherIconSelection.SHORTCUT_ID }?.lastChangedTimestamp
            if (stamp == shortcutStamp) return
            shortcutStamp = stamp
            refresh(user)
        }
    }

    fun install(xposed: XposedInterface) {
        moduleAPK = runCatching { xposed.moduleApplicationInfo.sourceDir }.getOrNull()
        runCatching { hookAnimatedIcon(xposed) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to hook launcher icon views", it) }
        runCatching { hookResources(xposed) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to hook launcher icon resources", it) }
        runCatching { hookActivityIcons(xposed) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to hook launcher activity icons", it) }
        runCatching { hookShortcutQueries(xposed) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to hide the launcher icon shortcut", it) }
        runCatching { hookCallbacks(xposed) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to hook launcher callbacks", it) }
    }

    private fun hookResources(xposed: XposedInterface) {
        val packageManager = Class.forName("android.app.ApplicationPackageManager")
        packageManager.declaredMethods
            .filter { it.name == "getResourcesForApplication" && it.parameterTypes.firstOrNull() == ApplicationInfo::class.java }
            .forEach { method ->
                xposed.hook(method).setExceptionMode(ExceptionMode.PROTECTIVE).intercept { chain ->
                    val resources = chain.proceed() as? Resources
                    val info = chain.getArg(0) as? ApplicationInfo
                    if (resources != null && info?.packageName == DISCORD) discordResources.add(resources)
                    resources
                }
            }

        val getDrawable = Resources::class.java.getDeclaredMethod(
            "getDrawableForDensity",
            Int::class.javaPrimitiveType,
            Int::class.javaPrimitiveType,
            Resources.Theme::class.java,
        )
        xposed.hook(getDrawable).setExceptionMode(ExceptionMode.PROTECTIVE).intercept { chain ->
            val resources = chain.thisObject as Resources
            val id = chain.getArg(0) as Int
            val custom = if (resources in discordResources && id in launcherIconIds()) {
                customIcon(chain.getArg(1) as Int)
            } else {
                null
            }
            custom ?: chain.proceed()
        }
    }

    private fun hookActivityIcons(xposed: XposedInterface) {
        val getIcon = LauncherActivityInfo::class.java.getDeclaredMethod("getIcon", Int::class.javaPrimitiveType)
        xposed.hook(getIcon).setExceptionMode(ExceptionMode.PROTECTIVE).intercept { chain ->
            val info = chain.thisObject as LauncherActivityInfo
            val custom = if (info.componentName.packageName == DISCORD) customIcon(chain.getArg(0) as Int) else null
            custom ?: chain.proceed()
        }
    }

    private fun hookShortcutQueries(xposed: XposedInterface) {
        val getShortcuts = LauncherApps::class.java.getDeclaredMethod(
            "getShortcuts",
            LauncherApps.ShortcutQuery::class.java,
            UserHandle::class.java,
        )
        xposed.hook(getShortcuts).setExceptionMode(ExceptionMode.PROTECTIVE).intercept { chain ->
            @Suppress("UNCHECKED_CAST")
            val shortcuts = chain.proceed() as? List<ShortcutInfo>
            if (ownQuery.get() == true || shortcuts == null) {
                shortcuts
            } else {
                shortcuts.filterNot { it.`package` == DISCORD && it.id == LauncherIconSelection.SHORTCUT_ID }
            }
        }
    }

    private fun hookCallbacks(xposed: XposedInterface) {
        val register = LauncherApps::class.java.getDeclaredMethod(
            "registerCallback",
            LauncherApps.Callback::class.java,
            Handler::class.java,
        )
        xposed.hook(register).setExceptionMode(ExceptionMode.PROTECTIVE).intercept { chain ->
            val result = chain.proceed()
            val callback = chain.getArg(0) as? LauncherApps.Callback
            if (callback != null && callback !== observer) {
                launcherCallbacks.add(callback to chain.getArg(1) as? Handler)
                observe(chain.thisObject as LauncherApps)
            }
            result
        }
    }

    private fun observe(launcherApps: LauncherApps) {
        if (observing) return
        observing = true
        launcherApps.registerCallback(observer, Handler(Looper.getMainLooper()))
        Handler(Looper.getMainLooper()).postDelayed({ refresh(android.os.Process.myUserHandle()) }, RECONCILE_DELAY_MS)
    }

    private fun refresh(user: UserHandle) {
        icons.clear()
        iconIds = null
        animatedSelected = null
        for ((callback, handler) in launcherCallbacks) {
            (handler ?: Handler(Looper.getMainLooper())).post { callback.onPackageChanged(DISCORD, user) }
        }
    }

    private fun launcherIconIds(): Set<Int> = iconIds ?: run {
        val context = application() ?: return emptySet()
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(DISCORD)
        val activities = context.packageManager.queryIntentActivities(
            launcher,
            PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DISABLED_COMPONENTS.toLong()),
        )
        val ids = activities.flatMap { listOf(it.activityInfo.iconResource, it.activityInfo.applicationInfo.icon) }
            .filter { it != 0 }
            .toSet()
        iconIds = ids
        ids
    }

    private fun customIcon(density: Int): Drawable? {
        val drawable = icons[density] ?: loadCustomIcon(density)?.also { icons[density] = it } ?: return null
        return drawable.constantState?.newDrawable() ?: drawable
    }

    private fun loadCustomIcon(density: Int): Drawable? {
        val context = application() ?: return null
        val launcherApps = context.getSystemService(LauncherApps::class.java) ?: return null
        val shortcut = runCatching { ownShortcut(launcherApps) }.getOrNull() ?: return null
        return launcherApps.getShortcutIconDrawable(shortcut, density)
    }

    private fun hookAnimatedIcon(xposed: XposedInterface) {
        val setDrawables = TextView::class.java.getDeclaredMethod(
            "setCompoundDrawables",
            Drawable::class.java,
            Drawable::class.java,
            Drawable::class.java,
            Drawable::class.java,
        )
        xposed.hook(setDrawables).setExceptionMode(ExceptionMode.PROTECTIVE).intercept { chain ->
            val view = chain.thisObject as TextView
            val top = chain.getArg(1) as? Drawable
            if (top == null || top is AnimatedIconDrawable || discordViews[view] != true) {
                chain.proceed()
            } else {
                val wrapped = animatedDrawable(top) ?: top
                chain.proceed(arrayOf(chain.getArg(0), wrapped, chain.getArg(2), chain.getArg(3)))
            }
        }
        val setTag = View::class.java.getDeclaredMethod("setTag", Any::class.java)
        xposed.hook(setTag).setExceptionMode(ExceptionMode.PROTECTIVE).intercept { chain ->
            val result = chain.proceed()
            val view = chain.thisObject as? TextView
            if (view != null) retag(view, chain.getArg(0))
            result
        }
    }

    private fun retag(view: TextView, tag: Any?) {
        val discord = isDiscordItem(tag)
        if (discord) discordViews[view] = true else discordViews.remove(view)
        val drawables = view.compoundDrawables
        val top = drawables[1] ?: return
        val replacement = when {
            discord && top !is AnimatedIconDrawable -> animatedDrawable(top)
            !discord && top is AnimatedIconDrawable -> top.original
            else -> null
        } ?: return
        view.setCompoundDrawables(drawables[0], replacement, drawables[2], drawables[3])
    }

    private fun isDiscordItem(tag: Any?): Boolean {
        if (tag == null || tag is String || tag is Number) return false
        val description = runCatching { tag.toString() }.getOrNull() ?: return false
        return description.contains("targetComponent=ComponentInfo{$DISCORD/")
    }

    private fun animatedDrawable(original: Drawable): AnimatedIconDrawable? {
        if (!isAnimatedSelected()) return null
        val (frames, timing) = loadAnimation() ?: return null
        return AnimatedIconDrawable(original, frames, timing)
    }

    private fun isAnimatedSelected(): Boolean = animatedSelected ?: run {
        val context = application()
        val launcherApps = context?.getSystemService(LauncherApps::class.java)
        val shortcut = launcherApps?.let { runCatching { ownShortcut(it) }.getOrNull() }
        val selected = shortcut?.extras?.getBoolean(AnimatedIconFrames.EXTRA) == true
        if (context != null) animatedSelected = selected
        selected
    }

    @Synchronized
    private fun loadAnimation(): Pair<List<Bitmap>, AnimatedIconTiming>? {
        animation?.let { return it }
        if (animationFailed) return null
        val apk = moduleAPK
        val loaded = runCatching {
            val timing = apk?.let(AnimatedIconFrames::timing) ?: return@runCatching null
            val frames = AnimatedIconFrames.bitmaps(apk, timing.durations.size) ?: return@runCatching null
            frames to timing
        }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to load the animated icon frames", it) }.getOrNull()
        if (loaded == null) animationFailed = true
        animation = loaded
        return loaded
    }

    private fun ownShortcut(launcherApps: LauncherApps): ShortcutInfo? {
        val query = LauncherApps.ShortcutQuery()
            .setPackage(DISCORD)
            .setShortcutIds(listOf(LauncherIconSelection.SHORTCUT_ID))
            .setQueryFlags(LauncherApps.ShortcutQuery.FLAG_MATCH_DYNAMIC)
        ownQuery.set(true)
        return try {
            launcherApps.getShortcuts(query, android.os.Process.myUserHandle())?.firstOrNull()
        } finally {
            ownQuery.set(false)
        }
    }

    private fun application(): Context? = runCatching {
        Class.forName("android.app.ActivityThread").getMethod("currentApplication").invoke(null) as? Application
    }.getOrNull()
}
