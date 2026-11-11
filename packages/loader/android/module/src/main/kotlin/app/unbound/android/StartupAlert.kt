package app.unbound.android

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper

object StartupAlert {
    private const val TITLE = "Unbound"

    private data class Pending(val title: String, val message: String, val reportable: Boolean)

    @Volatile private var pending: Pending? = null

    fun report(message: String, title: String = TITLE) {
        pending = Pending(title, message, reportable = false)
    }

    /** Shows [message] with a Report button that opens a prefilled crash report on GitHub. */
    @JvmStatic
    fun reportCrash(message: String) {
        pending = Pending(TITLE, message, reportable = true)
        Handler(Looper.getMainLooper()).post {
            ActivityTracker.currentActivity()?.let { if (!it.isFinishing) onResumed(it) }
        }
    }

    fun onResumed(activity: Activity) {
        val alert = pending ?: return
        pending = null
        val builder = AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle(alert.title)
            .setMessage(alert.message)
            .setPositiveButton(android.R.string.ok, null)
        if (alert.reportable) {
            builder.setNeutralButton("Report") { _, _ -> openCrashReport(activity) }
        }
        builder.show()
    }

    private fun openCrashReport(activity: Activity) {
        runCatching {
            val discord = activity.packageManager.getPackageInfo(activity.packageName, 0)
            val version = "${discord.versionName} (${discord.longVersionCode})"
            val url = NativeBridge.nativeToolbox("crash-report-url", version)
            if (url.isNullOrEmpty()) return
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to open the crash report", it) }
    }
}
