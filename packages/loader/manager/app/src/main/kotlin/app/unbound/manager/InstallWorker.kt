package app.unbound.manager

import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.ForegroundInfo
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import app.unbound.manager.core.Target

/**
 * Runs [Manager.drive] for one target. Unique work `install-<target>` keeps one runner per target, and
 * WorkManager reruns it after process death, where the loop resumes from the persisted phase.
 */
class InstallWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    private val target = inputData.getString(KEY_TARGET)?.let { name -> Target.entries.find { it.name == name } }

    override suspend fun doWork(): Result {
        val target = target ?: return Result.failure()
        val manager = Manager.get(applicationContext)

        manager.drive(target) {
            try {
                setForeground(foregroundInfo(target))
            } catch (error: IllegalStateException) {
                manager.log(target, "Could not run in the foreground: ${error.message}")
            }
        }
        return Result.success()
    }

    override suspend fun getForegroundInfo(): ForegroundInfo = foregroundInfo(target ?: Target.DISCORD)

    private fun foregroundInfo(target: Target) = ForegroundInfo(
        Notifier.progressId(target),
        Notifier.progress(applicationContext, target, 0, 0),
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC else 0,
    )

    companion object {
        private const val KEY_TARGET = "target"

        /** [replace] cancels a running runner first, so a cancelled download stops instead of finishing. */
        fun enqueue(context: Context, target: Target, replace: Boolean) {
            val request = OneTimeWorkRequestBuilder<InstallWorker>()
                .setInputData(workDataOf(KEY_TARGET to target.name))
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                "install-${target.name.lowercase()}",
                if (replace) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP,
                request,
            )
        }
    }
}
