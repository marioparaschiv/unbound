package app.unbound.manager

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * MY_PACKAGE_REPLACED: the manager's own update killed the process that ran it. Restarting the runner
 * lets the manager's record finish Confirming in the new build instead of waiting for the next app start.
 */
class PackageReplacedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return

        Manager.get(context).resume()
    }
}
