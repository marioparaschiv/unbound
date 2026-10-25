package app.unbound.android

import android.os.FileObserver
import android.os.Handler
import android.os.Looper
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList

object SettingsWatcher {
    private const val SETTINGS_FILE = "settings.json"
    private const val DEBOUNCE_MS = 300L
    private const val EVENTS = FileObserver.CLOSE_WRITE or FileObserver.MOVED_TO or FileObserver.CREATE

    private val main = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArrayList<() -> Unit>()
    private val notifyListeners = Runnable { listeners.forEach { listener -> runCatching(listener) } }
    private var observer: FileObserver? = null

    fun start(documents: String) {
        if (observer != null) return

        val directory = File(documents).apply { mkdirs() }
        observer = object : FileObserver(directory, EVENTS) {
            override fun onEvent(event: Int, path: String?) {
                if (path != SETTINGS_FILE) return
                main.removeCallbacks(notifyListeners)
                main.postDelayed(notifyListeners, DEBOUNCE_MS)
            }
        }.also { it.startWatching() }
    }

    fun onChange(listener: () -> Unit) {
        listeners += listener
    }
}
