package app.unbound.manager

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import app.unbound.manager.core.Announcement
import app.unbound.manager.core.Target
import app.unbound.manager.core.UpdateDecision
import app.unbound.manager.ui.describe
import app.unbound.manager.ui.shortTitle
import app.unbound.manager.ui.title

object Notifier {
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

    fun available(context: Context, target: Target, update: UpdateDecision.Available) {
        val install = Intent(context, InstallResultReceiver::class.java)
            .setAction(InstallResultReceiver.ACTION_UPDATE)
            .putExtra(InstallResultReceiver.EXTRA_TARGET, target.name)
        val newer = update.skipped.size
        val notification = Notification.Builder(context, channel(context, target))
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("${target.shortTitle} ${update.latest.version} is available")
            .setContentText(if (newer == 1) "Tap Update to install it." else "$newer new builds. Tap Update to install the newest.")
            .setContentIntent(openTarget(context, target))
            .setAutoCancel(true)
            .addAction(
                Notification.Action.Builder(
                    null,
                    "Update",
                    PendingIntent.getBroadcast(context, UPDATE_REQUEST_BASE + target.ordinal, install, IMMUTABLE_UPDATE),
                ).build(),
            )
            .build()

        manager(context).notify(newsId(target), notification)
    }

    fun landed(context: Context, target: Target, landed: Announcement.Landed) {
        val version = landed.release.version
        val title = if (landed.firstInstall) "Installed ${target.shortTitle} $version" else "Updated ${target.shortTitle} to $version"
        val notification = Notification.Builder(context, channel(context, target))
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(title)
            .setContentIntent(openTarget(context, target))
            .setAutoCancel(true)
            .build()

        manager(context).notify(newsId(target), notification)
    }

    fun failed(context: Context, target: Target, failed: Announcement.Failed) {
        val notification = Notification.Builder(context, channel(context, target))
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setContentTitle("Couldn't update ${target.shortTitle}")
            .setContentText(failed.failure.describe())
            .setContentIntent(openTarget(context, target))
            .setAutoCancel(true)
            .build()

        manager(context).notify(newsId(target), notification)
    }

    fun clearNews(context: Context, target: Target) = manager(context).cancel(newsId(target))

    fun hasConfirm(context: Context, target: Target): Boolean = manager(context).activeNotifications.any { it.id == confirmId(target) }

    fun clearConfirm(context: Context, target: Target) = manager(context).cancel(confirmId(target))

    fun progressId(target: Target): Int = PROGRESS_ID_BASE + target.ordinal

    private fun confirmId(target: Target): Int = CONFIRM_ID_BASE + target.ordinal

    private fun newsId(target: Target): Int = NEWS_ID_BASE + target.ordinal

    private fun channel(context: Context, target: Target): String {
        val id = "target-${target.name.lowercase()}"
        val name = "${target.title} updates"
        manager(context).createNotificationChannel(NotificationChannel(id, name, NotificationManager.IMPORTANCE_DEFAULT))
        return id
    }

    private fun openApp(context: Context) =
        PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)

    private fun openTarget(context: Context, target: Target) = PendingIntent.getActivity(
        context,
        OPEN_REQUEST_BASE + target.ordinal,
        Intent(context, MainActivity::class.java).putExtra(MainActivity.EXTRA_TARGET, target.name),
        IMMUTABLE_UPDATE,
    )

    private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)
}

private const val PROGRESS_SCALE = 1000
private const val PROGRESS_ID_BASE = 100
private const val CONFIRM_ID_BASE = 200
private const val NEWS_ID_BASE = 300
private const val UPDATE_REQUEST_BASE = 100
private const val OPEN_REQUEST_BASE = 200
private const val IMMUTABLE_UPDATE = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
