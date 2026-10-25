package app.unbound.android

import java.net.HttpURLConnection
import java.net.URL

object HotReload {
    private const val READ_BUFFER_SIZE = 4096

    @Volatile
    private var running = false

    fun observe() {
        if (running || !NativeBridge.preferenceEnabled("hot-reload")) return

        val url = NativeBridge.nativeHotReloadURL()?.let { runCatching { URL(it) }.getOrNull() }
        if (url == null) {
            Logger.info("updater", "Hot-reload: no dev server origin resolved; live reload not started.")
            return
        }

        running = true
        Logger.info("updater", "Hot-reload: enabled.")
        Thread({ streamForever(url) }, "unbound-hot-reload").apply { isDaemon = true }.start()
    }

    private fun streamForever(url: URL) {
        while (running) {
            runCatching {
                Logger.info("updater", "Hot-reload: connecting SSE to $url")
                stream(url)
                Logger.info("updater", "Hot-reload: SSE stream closed.")
            }.onFailure { Logger.info("updater", "Hot-reload: SSE disconnected (${it.message}).") }

            val delay = NativeBridge.nativeHotReloadNextDelayMs()
            Logger.info("updater", "Hot-reload: reconnecting in ${delay / 1000}s.")
            Thread.sleep(delay)
        }
    }

    private fun stream(url: URL) {
        val connection = url.openConnection() as HttpURLConnection
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
                while (true) {
                    val count = reader.read(buffer)
                    if (count < 0) break
                    if (NativeBridge.nativeHotReloadFeed(String(buffer, 0, count))) Platform.restartApp()
                }
            }
        } finally {
            connection.disconnect()
        }
    }
}
