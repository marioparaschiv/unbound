package app.unbound.android

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.SystemClock
import kotlin.concurrent.thread

object ScheduledRefresh {
    private const val ACTION = "app.unbound.android.SCHEDULED_REFRESH"
    private const val REQUEST_CODE = 0x55424e44
    const val INTERVAL_MS = 6 * 60 * 60 * 1000L
    const val WAIT_LIMIT_MS = 9_000L
    private const val POLL_MS = 250L

    private val lock = Any()
    private var installed = false

    fun install(context: Context) {
        val application = context.applicationContext
        synchronized(lock) {
            if (installed) return
            register(application)
            schedule(application)
            installed = true
            NativeBridge.nativeSetScheduledRefresh("every 6 h while Discord's process is alive (inexact alarm)")
        }
    }

    private fun register(context: Context) {
        val filter = IntentFilter(ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(Receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(Receiver, filter)
        }
        // A system broadcast, so it registers exported; it reaches only a running process.
        context.registerReceiver(ChargeReceiver, IntentFilter(Intent.ACTION_POWER_CONNECTED))
    }

    private fun schedule(context: Context) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        val intent = Intent(ACTION).setPackage(context.packageName)
        val pending = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        alarms.setInexactRepeating(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + INTERVAL_MS,
            INTERVAL_MS,
            pending,
        )
    }

    fun waitWhileWorking(working: () -> Boolean, now: () -> Long, sleep: (Long) -> Unit) {
        val deadline = now() + WAIT_LIMIT_MS
        while (working() && now() < deadline) sleep(POLL_MS)
    }

    private fun refresh(result: BroadcastReceiver.PendingResult, start: () -> Boolean) {
        thread(name = "Unbound scheduled refresh") {
            try {
                if (start()) {
                    waitWhileWorking(NativeBridge::nativeIsWorkingInBackground, SystemClock::elapsedRealtime, Thread::sleep)
                }
            } catch (error: Throwable) {
                Logger.error(LogCategory.DEFAULT, "Failed to run the scheduled refresh", error)
            } finally {
                result.finish()
            }
        }
    }

    private object Receiver : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            Logger.info(LogCategory.DEFAULT, "The scheduled background refresh fired.")
            refresh(goAsync(), NativeBridge::nativeOnScheduledRefresh)
        }
    }

    private object ChargeReceiver : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            refresh(goAsync(), NativeBridge::nativeOnCharging)
        }
    }
}
