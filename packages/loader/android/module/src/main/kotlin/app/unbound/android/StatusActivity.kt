package app.unbound.android

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import io.github.libxposed.service.XposedService
import io.github.libxposed.service.XposedServiceHelper

class StatusActivity : Activity() {
    companion object {
        private const val FRAMEWORK_TIMEOUT_MS = 3_000L
        private const val BACKGROUND = 0xFF1A1A1E.toInt()
        private const val CARD = 0xFF2B2D31.toInt()
        private const val MUTED = 0xFFB5BAC1.toInt()
        private val LEVEL_COLORS = mapOf(
            StatusLevel.GOOD to 0xFF23A55A.toInt(),
            StatusLevel.WARNING to 0xFFF0B232.toInt(),
            StatusLevel.BAD to 0xFFF23F43.toInt(),
        )
    }

    private val handler = Handler(Looper.getMainLooper())
    private var framework: FrameworkFacts? = null
    private var timedOut = false
    private lateinit var summary: TextView
    private lateinit var rows: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildContent())
        XposedServiceHelper.registerListener(object : XposedServiceHelper.OnServiceListener {
            override fun onServiceBind(service: XposedService) {
                val facts = runCatching { frameworkFacts(service) }.getOrNull()
                handler.post {
                    framework = facts
                    render()
                }
            }

            override fun onServiceDied(service: XposedService) {
                handler.post {
                    framework = null
                    render()
                }
            }
        })
        handler.postDelayed({
            timedOut = true
            render()
        }, FRAMEWORK_TIMEOUT_MS)
        render()
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun frameworkFacts(service: XposedService): FrameworkFacts = FrameworkFacts(
        name = service.frameworkName,
        version = service.frameworkVersion,
        apiVersion = service.apiVersion,
        scope = service.scope,
    )

    private fun input(): ModuleStatusInput = ModuleStatusInput(
        moduleVersion = "${BuildConfig.VERSION_NAME} (${BuildConfig.COMMIT_SHORT_HASH})",
        framework = framework,
        frameworkTimedOut = timedOut,
        discordVersion = discordVersion(),
        legacyFramework = legacyFramework(),
    )

    private fun legacyFramework(): String? = ModuleStatus.LEGACY_FRAMEWORKS.entries.firstOrNull { (name, _) ->
        runCatching { packageManager.getPackageInfo(name, 0) }.isSuccess
    }?.value

    private fun discordVersion(): String? = runCatching {
        val info = packageManager.getPackageInfo(ModuleStatus.DISCORD_PACKAGE, 0)
        "${info.versionName} (${info.longVersionCode})"
    }.getOrElse { error -> if (error is PackageManager.NameNotFoundException) null else "Unknown" }

    private fun render() {
        if (!::rows.isInitialized) return
        val input = input()
        summary.text = ModuleStatus.summary(input)
        rows.removeAllViews()
        ModuleStatus.rows(input).forEach { row -> rows.addView(rowView(row)) }
    }

    private fun dp(value: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

    private fun buildContent(): ScrollView {
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(48), dp(20), dp(24))
        }
        column.addView(text("Unbound", 28f, Color.WHITE, bold = true))
        summary = text("", 15f, MUTED).apply { setPadding(0, dp(6), 0, dp(20)) }
        column.addView(summary)
        rows = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = rounded(CARD)
            setPadding(dp(16), dp(6), dp(16), dp(6))
        }
        column.addView(rows)
        column.addView(openDiscordButton())
        return ScrollView(this).apply {
            setBackgroundColor(BACKGROUND)
            addView(column, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        }
    }

    private fun rowView(row: StatusRow): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(0, dp(12), 0, dp(12))
        addView(
            TextView(this@StatusActivity).apply {
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(LEVEL_COLORS.getValue(row.level))
                }
            },
            LinearLayout.LayoutParams(dp(10), dp(10)).apply { marginEnd = dp(12) },
        )
        addView(text(row.label, 15f, Color.WHITE, bold = true), LinearLayout.LayoutParams(dp(96), WRAP_CONTENT))
        addView(text(row.value, 15f, MUTED), LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
    }

    private fun openDiscordButton(): Button = Button(this).apply {
        text = "Open Discord"
        isAllCaps = false
        setTextColor(Color.WHITE)
        background = rounded(0xFF5865F2.toInt())
        layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, dp(48)).apply { topMargin = dp(20) }
        setOnClickListener {
            packageManager.getLaunchIntentForPackage(ModuleStatus.DISCORD_PACKAGE)
                ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                ?.let(::startActivity)
        }
    }

    private fun rounded(color: Int): GradientDrawable = GradientDrawable().apply {
        cornerRadius = dp(12).toFloat()
        setColor(color)
    }

    private fun text(value: String, size: Float, color: Int, bold: Boolean = false): TextView = TextView(this).apply {
        text = value
        setTextColor(color)
        textSize = size
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }
}
