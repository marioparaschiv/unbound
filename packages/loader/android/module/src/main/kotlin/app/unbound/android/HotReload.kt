package app.unbound.android

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object HotReload {
    private const val MIN_RECONNECT_DELAY_MS = 1_000L
    private const val MAX_RECONNECT_DELAY_MS = 30_000L

    @Volatile
    private var running = false

    fun observe() {
        if (running || !NativeBridge.nativeGetBoolean("unbound", "loader.update.hmr", false)) return

        val url = resolveHotURL()
        if (url == null) {
            Logger.info("updater", "Hot-reload: no dev server origin resolved; live reload not started.")
            return
        }

        running = true
        Logger.info("updater", "Hot-reload: enabled.")
        Thread({ streamForever(url) }, "unbound-hot-reload").apply { isDaemon = true }.start()
    }

    private fun resolveHotURL(): URL? {
        val configured = NativeBridge.nativeSettingJSON("unbound", "loader.update.url")
            ?.let { runCatching { JSONObject("{\"url\":$it}").optString("url") }.getOrNull() }
            ?.takeIf { it.isNotEmpty() }
        val base = configured ?: NativeBridge.devServerURL() ?: return null
        return runCatching {
            val origin = URL(base)
            URL(origin.protocol, origin.host, origin.port, "/__hot")
        }.getOrNull()
    }

    private fun streamForever(url: URL) {
        var delay = MIN_RECONNECT_DELAY_MS
        while (running) {
            runCatching {
                Logger.info("updater", "Hot-reload: connecting SSE to $url")
                stream(url)
                delay = MIN_RECONNECT_DELAY_MS
                Logger.info("updater", "Hot-reload: SSE stream closed.")
            }.onFailure { Logger.info("updater", "Hot-reload: SSE disconnected (${it.message}).") }

            Logger.info("updater", "Hot-reload: reconnecting in ${delay / 1000}s.")
            Thread.sleep(delay)
            delay = (delay * 2).coerceAtMost(MAX_RECONNECT_DELAY_MS)
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
            Logger.info("updater", "Hot-reload: SSE connected.")
            connection.inputStream.bufferedReader().use { reader ->
                val event = ArrayList<String>()
                while (true) {
                    val line = reader.readLine() ?: break
                    if (line.isNotEmpty()) {
                        event.add(line)
                        continue
                    }
                    handleEvent(event)
                    event.clear()
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun normalizeEtag(etag: String): String = etag.removePrefix("W/").trim('"')

    private fun handleEvent(lines: List<String>) {
        val name = lines.firstOrNull { it.startsWith("event:") }?.removePrefix("event:")?.trim()
        val data = lines.firstOrNull { it.startsWith("data:") }?.removePrefix("data:")?.trim()
        if (name != "reload" || data.isNullOrEmpty()) return

        val incoming = runCatching { JSONObject(data).optString("etag") }.getOrNull()
            ?.takeIf { it.isNotEmpty() } ?: return
        val stored = NativeBridge.nativeSettingJSON("unbound", "loader.update.etag")
            ?.let { runCatching { JSONObject("{\"etag\":$it}").optString("etag") }.getOrNull() }
            .orEmpty()

        if (stored.isNotEmpty() && normalizeEtag(stored) == normalizeEtag(incoming)) {
            Logger.info("updater", "Hot-reload: etag unchanged ($incoming); skipping reload.")
            return
        }

        Logger.info("updater", "Hot-reload: etag mismatch (stored ${stored.ifEmpty { "<none>" }}, incoming $incoming) -> reloading.")
        Platform.restartApp()
    }
}
