package app.unbound.android

import android.os.FileObserver
import android.os.Handler
import android.os.Looper
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

object SettingsWatcher {
    private const val EVENTS = FileObserver.CLOSE_WRITE or FileObserver.MOVED_TO or FileObserver.CREATE

    private val main = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArrayList<() -> Unit>()
    private val notifyListeners = Runnable { listeners.forEach { listener -> runCatching(listener) } }
    private val observers = ConcurrentHashMap<String, FileObserver>()

    @JvmStatic
    external fun nativeStart(documents: String)

    @JvmStatic
    external fun nativeDirectoryEvent(directory: String, name: String?)

    fun start(documents: String) {
        nativeStart(File(documents).apply { mkdirs() }.path)
    }

    fun onChange(listener: () -> Unit) {
        listeners += listener
    }

    @JvmStatic
    fun observe(directory: String) {
        observers.computeIfAbsent(directory) {
            object : FileObserver(File(directory), EVENTS) {
                override fun onEvent(event: Int, path: String?) {
                    if (path != null) nativeDirectoryEvent(directory, path)
                }
            }.also { it.startWatching() }
        }
    }

    @JvmStatic
    fun stopObserving(directory: String) {
        observers.remove(directory)?.stopWatching()
    }

    @JvmStatic
    fun changed() {
        main.post(notifyListeners)
    }
}
