package app.unbound.android

import org.json.JSONArray
import org.json.JSONObject

object NativeEvaluations {
    private const val HISTORY_LIMIT = 50
    private const val FIELD_LIMIT = 16384
    private const val LOG_LINE_LIMIT = 200
    private const val LOG_FIELD_LIMIT = 512

    data class LogLine(val level: Int, val message: String)

    data class Record(
        val identifier: String,
        val code: String,
        val ok: Boolean,
        val value: String?,
        val error: String?,
        val logs: List<LogLine>,
        val recordedAt: Long,
    )

    private val history = ArrayDeque<Record>()

    fun record(recordJSON: String): Boolean {
        val parsed = runCatching { JSONObject(recordJSON) }.getOrNull() ?: return reject("invalid JSON")
        val identifier = parsed.optString("id")
        val code = parsed.optString("code")

        if (identifier.isEmpty() || code.isEmpty()) return reject("missing id or code")

        val record = Record(
            truncate(identifier, FIELD_LIMIT),
            truncate(code, FIELD_LIMIT),
            parsed.optBoolean("ok", false),
            parsed.optString("value").takeIf { parsed.has("value") && it.isNotEmpty() }
                ?.let { truncate(it, FIELD_LIMIT) },
            parsed.optString("error").takeIf { parsed.has("error") && it.isNotEmpty() }
                ?.let { truncate(it, FIELD_LIMIT) },
            parseLogs(parsed.optJSONArray("logs")),
            System.currentTimeMillis(),
        )

        synchronized(this) {
            history.addLast(record)
            while (history.size > HISTORY_LIMIT) history.removeFirst()
        }

        log(record)

        return true
    }

    fun history(): String {
        val records = synchronized(this) { history.toList() }

        return JSONArray().apply {
            for (record in records) {
                put(
                    JSONObject()
                        .put("id", record.identifier)
                        .put("code", record.code)
                        .put("ok", record.ok)
                        .put("value", record.value ?: JSONObject.NULL)
                        .put("error", record.error ?: JSONObject.NULL)
                        .put("recordedAt", record.recordedAt)
                        .put(
                            "logs",
                            JSONArray().apply {
                                for (line in record.logs) {
                                    put(
                                        JSONObject()
                                            .put("level", line.level)
                                            .put("message", line.message),
                                    )
                                }
                            },
                        ),
                )
            }
        }.toString()
    }

    fun clear() {
        synchronized(this) { history.clear() }
    }

    fun environment(): String =
        JSONObject()
            .put("isVirtualDevice", Platform.isEmulator())
            .put("hostAddress", Platform.emulatorHostAddress() ?: JSONObject.NULL)
            .toString()

    private fun parseLogs(lines: JSONArray?): List<LogLine> {
        if (lines == null) return emptyList()

        val parsed = ArrayList<LogLine>()
        for (index in 0 until minOf(lines.length(), LOG_LINE_LIMIT)) {
            val line = lines.optJSONObject(index) ?: continue
            val level = line.optInt("level", 1).coerceIn(1, 3)
            val message = truncate(line.optString("message"), LOG_FIELD_LIMIT)
            if (message.isNotEmpty()) parsed.add(LogLine(level, message))
        }

        return parsed
    }

    private fun log(record: Record) {
        val outcome = if (record.ok) "ok" else "failed"
        Logger.info("debugger", "Evaluation ${record.identifier} $outcome")
        for (line in record.logs) {
            val message = "Evaluation ${record.identifier}: ${line.message}"
            when (line.level) {
                3 -> Logger.error("debugger", message)
                else -> Logger.info("debugger", message)
            }
        }
    }

    private fun reject(reason: String): Boolean {
        Logger.error("debugger", "Rejected evaluation record: $reason")

        return false
    }

    private fun truncate(value: String, limit: Int): String =
        if (value.length <= limit) value else value.take(limit)
}
