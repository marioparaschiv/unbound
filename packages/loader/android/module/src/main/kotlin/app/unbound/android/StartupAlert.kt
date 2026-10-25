package app.unbound.android

import android.app.Activity
import android.app.AlertDialog

object StartupAlert {
    private const val TITLE = "Unbound"

    @Volatile private var pending: String? = null

    fun report(message: String) {
        pending = message
    }

    fun onResumed(activity: Activity) {
        val message = pending ?: return
        pending = null
        AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle(TITLE)
            .setMessage(message)
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }
}
