package app.unbound.manager

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class CheckWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        Manager.get(applicationContext).check()
        return Result.success()
    }

    companion object {
        /** KEEP: rescheduling on every start would push the next run back each time the app opens. */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<CheckWorker>(INTERVAL_HOURS, TimeUnit.HOURS, FLEX_HOURS, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork("check", ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
}

private const val INTERVAL_HOURS = 6L
private const val FLEX_HOURS = 1L
