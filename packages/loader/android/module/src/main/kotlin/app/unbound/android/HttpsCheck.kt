package app.unbound.android

import org.json.JSONArray
import org.json.JSONObject
import java.net.URL
import java.security.cert.X509Certificate
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.net.ssl.HttpsURLConnection

object HttpsCheck {
    private const val PROBE_URL = "https://discord.com/api/v9/gateway"
    private const val DELAY_SECONDS = 20L
    private const val TIMEOUT_MS = 15_000
    private val COMMON_NAME = Regex("CN=([^,]+)")

    private val executor = Executors.newSingleThreadScheduledExecutor { runnable ->
        Thread(runnable, "unbound-https-check").apply { isDaemon = true }
    }

    fun schedule() {
        executor.schedule({ report(check()) }, DELAY_SECONDS, TimeUnit.SECONDS)
    }

    private fun check(): JSONObject = runCatching {
        val connection = URL(PROBE_URL).openConnection() as HttpsURLConnection
        connection.requestMethod = "HEAD"
        connection.connectTimeout = TIMEOUT_MS
        connection.readTimeout = TIMEOUT_MS
        try {
            connection.connect()
            val issuers = connection.serverCertificates
                .filterIsInstance<X509Certificate>()
                .mapNotNull { COMMON_NAME.find(it.issuerX500Principal.name)?.groupValues?.get(1) }
            JSONObject().put("completed", true).put("issuers", JSONArray(issuers))
        } finally {
            connection.disconnect()
        }
    }.getOrElse { JSONObject().put("completed", false).put("failure", NativeBridge.downloadFailureReason(it)) }

    private fun report(result: JSONObject) {
        runCatching { NativeBridge.nativeRecordHttpsCheck(result.toString()) }
            .onFailure { Logger.error(LogCategory.DEFAULT, "Failed to record the HTTPS check", it) }
    }
}
