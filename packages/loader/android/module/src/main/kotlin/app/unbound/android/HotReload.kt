package app.unbound.android

import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

object HotReload {
    private const val READ_BUFFER_SIZE = 4096

    private val session = AtomicInteger()
    private val control = Executors.newSingleThreadExecutor { Thread(it, "unbound-hot-reload-control").apply { isDaemon = true } }

    @Volatile
    private var active = 0

    @Volatile
    private var connection: HttpURLConnection? = null

    fun sync() {
        control.execute { if (NativeBridge.preferenceEnabled("hot-reload")) start() else stop() }
    }

    private fun start() {
        if (active != 0) return

        val url = NativeBridge.nativeHotReloadURL()?.let { runCatching { URL(it) }.getOrNull() }
        if (url == null) {
            Logger.info("updater", "Hot-reload: no dev server origin resolved; live reload not started.")
            return
        }

        val current = session.incrementAndGet()
        active = current
        Logger.info("updater", "Hot-reload: enabled.")
        Thread({ streamWhileActive(url, current) }, "unbound-hot-reload").apply { isDaemon = true }.start()
    }

    private fun stop() {
        if (active == 0) return

        active = 0
        connection?.disconnect()
        Logger.info("updater", "Hot-reload: disabled.")
    }

    private fun streamWhileActive(url: URL, current: Int) {
        while (active == current) {
            runCatching {
                Logger.info("updater", "Hot-reload: connecting SSE to $url")
                stream(url, current)
                Logger.info("updater", "Hot-reload: SSE stream closed.")
            }.onFailure { Logger.info("updater", "Hot-reload: SSE disconnected (${it.message}).") }

            if (active != current) break
            val delay = NativeBridge.nativeHotReloadNextDelayMs()
            Logger.info("updater", "Hot-reload: reconnecting in ${delay / 1000}s.")
            Thread.sleep(delay)
        }
    }

    private fun stream(url: URL, current: Int) {
        val connection = url.openConnection() as HttpURLConnection
        this.connection = connection
        connection.setRequestProperty("Accept", "text/event-stream")
        connection.setRequestProperty("Cache-Control", "no-cache")
        connection.connectTimeout = 5_000
        connection.readTimeout = 0

        try {
            if (connection.responseCode != HttpURLConnection.HTTP_OK) error("HTTP ${connection.responseCode}")
            NativeBridge.nativeHotReloadConnected()
            Logger.info("updater", "Hot-reload: SSE connected.")
            connection.inputStream.bufferedReader().use { reader ->
                val buffer = CharArray(READ_BUFFER_SIZE)
                while (active == current) {
                    val count = reader.read(buffer)
                    if (count < 0) break
                    if (NativeBridge.nativeHotReloadFeed(String(buffer, 0, count))) Platform.restartApp()
                }
            }
        } finally {
            if (this.connection === connection) this.connection = null
            connection.disconnect()
        }
    }
}
