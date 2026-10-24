package app.unbound.android

import android.util.Log

object Logger {
    private const val TAG = "Unbound"

    fun info(category: String, message: String) {
        Log.i(TAG, "[$category] $message")
    }

    fun error(category: String, message: String, error: Throwable? = null) {
        Log.e(TAG, "[$category] $message", error)
    }
}
