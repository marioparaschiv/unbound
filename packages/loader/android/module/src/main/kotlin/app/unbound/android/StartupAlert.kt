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

    /** Shows [message] in a dialog, as the iOS loader's alert does; a toast would cut it to two lines. */
    @JvmStatic
    fun show(message: String) {
        present(Pending(TITLE, message, reportable = false))
    }

    /** Shows [message] with a Report button that opens a prefilled crash report on GitHub. */
    @JvmStatic
    fun reportCrash(message: String) {
        present(Pending(TITLE, message, reportable = true))
    }

    // Shows the alert now if an activity is up; otherwise the next resumed activity shows it.
    private fun present(alert: Pending) {
        pending = alert
        Handler(Looper.getMainLooper()).post {
            ActivityTracker.currentActivity()?.let { if (!it.isFinishing) onResumed(it) }
        }
    }

    @JvmStatic
    fun offerToolbox(message: String) {
        Handler(Looper.getMainLooper()).post {
            val activity = ActivityTracker.currentActivity() ?: return@post
            if (activity.isFinishing) return@post
            AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                .setTitle(TITLE)
                .setMessage(message)
                .setPositiveButton(NativeBridge.text("UNBOUND_NATIVE_OPEN_TOOLBOX", "Open Toolbox")) { _, _ -> Toolbox.show() }
                .setNegativeButton(NativeBridge.text("UNBOUND_NATIVE_KEEP_WAITING", "Keep Waiting"), null)
                .show()
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
            builder.setNeutralButton(NativeBridge.text("UNBOUND_NATIVE_REPORT", "Report")) { _, _ -> openCrashReport(activity) }
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
