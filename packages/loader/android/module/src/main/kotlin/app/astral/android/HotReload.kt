package app.astral.android

import java.net.HttpURLConnection
import java.net.URL

object HotReload {
    private const val READ_BUFFER_SIZE = 4096

    @Volatile
    private var current = 0L

    @Volatile
    private var connection: HttpURLConnection? = null

    @JvmStatic
    external fun nativeSync()

    @JvmStatic
    external fun nativeResponse(connection: Long, status: Int): Boolean

    @JvmStatic
    external fun nativeChunk(connection: Long, chunk: ByteArray, length: Int): Boolean

    @JvmStatic
    external fun nativeClosed(connection: Long, error: String?)

    fun sync() = nativeSync()

    @JvmStatic
    fun open(
        id: Long,
        url: String,
        headerKeys: Array<String>,
        headerValues: Array<String>,
        connectTimeoutMs: Int,
        readTimeoutMs: Int,
    ) {
        current = id
        val headers = headerKeys.zip(headerValues)
        Thread({
            val failure = runCatching { stream(id, url, headers, connectTimeoutMs, readTimeoutMs) }
                .exceptionOrNull()
            nativeClosed(id, failure?.let { it.message ?: it.javaClass.simpleName })
        }, "astral-hot-reload").apply { isDaemon = true }.start()
    }

    @JvmStatic
    fun cancel() {
        current = 0
        connection?.disconnect()
    }

    @JvmStatic
    fun reload() = Platform.restartApp()

    private fun stream(
        id: Long,
        url: String,
        headers: List<Pair<String, String>>,
        connectTimeoutMs: Int,
        readTimeoutMs: Int,
    ) {
        val connection = URL(url).openConnection() as HttpURLConnection
        this.connection = connection
        try {
            if (current != id) return
            headers.forEach { (key, value) -> connection.setRequestProperty(key, value) }
            connection.connectTimeout = connectTimeoutMs
            connection.readTimeout = readTimeoutMs
            if (!nativeResponse(id, connection.responseCode)) return

            connection.inputStream.use { input ->
                val buffer = ByteArray(READ_BUFFER_SIZE)
                while (current == id) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (!nativeChunk(id, buffer, count)) break
                }
            }
        } finally {
            if (this.connection === connection) this.connection = null
            connection.disconnect()
        }
    }
}
