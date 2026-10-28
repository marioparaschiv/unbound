package app.unbound.manager

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import androidx.core.content.IntentCompat
import app.unbound.manager.core.Target
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** PackageInstaller results and dismissed confirm notifications. Manifest-registered, so a result wakes a dead process. */
class InstallResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val target = intent.getStringExtra(EXTRA_TARGET)?.let { name -> Target.entries.find { it.name == name } } ?: return
        val manager = Manager.get(context)
        val pending = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                when (intent.action) {
                    ACTION_SESSION_RESULT -> manager.onSessionResult(
                        target,
                        intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1),
                        intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE),
                        intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE),
                        IntentCompat.getParcelableExtra(intent, Intent.EXTRA_INTENT, Intent::class.java),
                    )

                    ACTION_CONFIRM_DISMISSED -> manager.cancel(target)
                }
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        const val ACTION_SESSION_RESULT = "app.unbound.manager.SESSION_RESULT"
        const val ACTION_CONFIRM_DISMISSED = "app.unbound.manager.CONFIRM_DISMISSED"
        const val EXTRA_TARGET = "target"
    }
}
