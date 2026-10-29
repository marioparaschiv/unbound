package app.unbound.android

import android.app.Activity
import android.app.AlertDialog

object StartupAlert {
    private const val TITLE = "Unbound"

    @Volatile private var pending: Pair<String, String>? = null

    fun report(message: String, title: String = TITLE) {
        pending = title to message
    }

    fun onResumed(activity: Activity) {
        val (title, message) = pending ?: return
        pending = null
        AlertDialog.Builder(activity, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }
}
