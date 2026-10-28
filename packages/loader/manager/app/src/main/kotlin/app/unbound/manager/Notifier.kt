package app.unbound.manager

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import app.unbound.manager.core.Target
import app.unbound.manager.ui.title

/** One channel per target. Each target owns two notification ids: install progress and the confirm prompt. */
object Notifier {
    /** The foreground notification while a download runs. */
    fun progress(context: Context, target: Target, done: Long, total: Long): Notification =
        Notification.Builder(context, channel(context, target))
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle("Downloading ${target.title}")
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setProgress(PROGRESS_SCALE, if (total > 0) (done * PROGRESS_SCALE / total).toInt() else 0, total <= 0)
            .setContentIntent(openApp(context))
            .build()

    fun showProgress(context: Context, target: Target, done: Long, total: Long) {
        manager(context).notify(progressId(target), progress(context, target, done, total))
    }

    /** Removes a progress notification posted without a foreground service. A foreground one ignores this. */
    fun clearProgress(context: Context, target: Target) = manager(context).cancel(progressId(target))

    /**
     * Wraps the installer's confirm Intent so a tap starts it with the user's grant, which a receiver cannot.
     * It doubles as the proof, after process death, that the Intent was not lost. Dismissing it cancels the install.
     */
    fun confirm(context: Context, target: Target, intent: Intent) {
        val dismissed = Intent(context, InstallResultReceiver::class.java)
            .setAction(InstallResultReceiver.ACTION_CONFIRM_DISMISSED)
            .putExtra(InstallResultReceiver.EXTRA_TARGET, target.name)
        val notification = Notification.Builder(context, channel(context, target))
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle("Tap to finish installing ${target.title}")
            .setContentText("Android needs you to confirm the install.")
            .setContentIntent(PendingIntent.getActivity(context, target.ordinal, intent, IMMUTABLE_UPDATE))
            .setDeleteIntent(PendingIntent.getBroadcast(context, target.ordinal, dismissed, IMMUTABLE_UPDATE))
            .build()

        manager(context).notify(confirmId(target), notification)
    }

    fun hasConfirm(context: Context, target: Target): Boolean = manager(context).activeNotifications.any { it.id == confirmId(target) }

    fun clearConfirm(context: Context, target: Target) = manager(context).cancel(confirmId(target))

    fun progressId(target: Target): Int = PROGRESS_ID_BASE + target.ordinal

    private fun confirmId(target: Target): Int = CONFIRM_ID_BASE + target.ordinal

    private fun channel(context: Context, target: Target): String {
        val id = "target-${target.name.lowercase()}"
        manager(context).createNotificationChannel(NotificationChannel(id, target.title, NotificationManager.IMPORTANCE_DEFAULT))
        return id
    }

    private fun openApp(context: Context) =
        PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)

    private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)
}

private const val PROGRESS_SCALE = 1000
private const val PROGRESS_ID_BASE = 100
private const val CONFIRM_ID_BASE = 200
private const val IMMUTABLE_UPDATE = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
