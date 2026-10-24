package app.unbound.android

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class NativeEvaluationsTest {
    @Before
    fun clearHistory() {
        NativeEvaluations.clear()
    }

    @Test
    fun recordsAnEvaluationAndReturnsItInHistory() {
        assertTrue(
            NativeEvaluations.record(
                """{"id":"e1","code":"1 + 1","ok":true,"value":"2"}""",
            ),
        )

        val history = JSONArray(NativeEvaluations.history())

        assertEquals(1, history.length())
        assertEquals("e1", history.getJSONObject(0).getString("id"))
        assertEquals("1 + 1", history.getJSONObject(0).getString("code"))
        assertEquals(true, history.getJSONObject(0).getBoolean("ok"))
        assertEquals("2", history.getJSONObject(0).getString("value"))
    }

    @Test
    fun rejectsARecordWithoutAnIdentifierOrCode() {
        assertFalse(NativeEvaluations.record("""{"code":"1"}"""))
        assertFalse(NativeEvaluations.record("""{"id":"e1"}"""))
        assertFalse(NativeEvaluations.record("not json"))
        assertEquals(0, JSONArray(NativeEvaluations.history()).length())
    }

    @Test
    fun keepsAFailedEvaluationWithItsError() {
        NativeEvaluations.record(
            """{"id":"e2","code":"boom()","ok":false,"error":"ReferenceError"}""",
        )

        val record = JSONArray(NativeEvaluations.history()).getJSONObject(0)

        assertEquals(false, record.getBoolean("ok"))
        assertEquals("ReferenceError", record.getString("error"))
    }

    @Test
    fun keepsLogLinesWithTheirLevels() {
        NativeEvaluations.record(
            """{"id":"e3","code":"log()","ok":true,"logs":[{"level":1,"message":"hello"},{"level":3,"message":"bad"}]}""",
        )

        val logs = JSONArray(NativeEvaluations.history()).getJSONObject(0).getJSONArray("logs")

        assertEquals(2, logs.length())
        assertEquals(1, logs.getJSONObject(0).getInt("level"))
        assertEquals("hello", logs.getJSONObject(0).getString("message"))
        assertEquals(3, logs.getJSONObject(1).getInt("level"))
    }

    @Test
    fun boundsHistoryToTheMostRecentRecords() {
        for (index in 1..60) {
            NativeEvaluations.record("""{"id":"e$index","code":"x","ok":true}""")
        }

        val history = JSONArray(NativeEvaluations.history())

        assertEquals(50, history.length())
        assertEquals("e11", history.getJSONObject(0).getString("id"))
        assertEquals("e60", history.getJSONObject(49).getString("id"))
    }

    @Test
    fun truncatesAnOversizedField() {
        val code = "a".repeat(20000)
        NativeEvaluations.record(JSONObject().put("id", "e4").put("code", code).put("ok", true).toString())

        assertEquals(
            16384,
            JSONArray(NativeEvaluations.history()).getJSONObject(0).getString("code").length,
        )
    }

    @Test
    fun boundsTheNumberOfLogLines() {
        val logs = JSONArray()
        for (index in 1..250) {
            logs.put(JSONObject().put("level", 1).put("message", "line $index"))
        }
        NativeEvaluations.record(
            JSONObject().put("id", "e5").put("code", "x").put("ok", true).put("logs", logs).toString(),
        )

        assertEquals(
            200,
            JSONArray(NativeEvaluations.history()).getJSONObject(0).getJSONArray("logs").length(),
        )
    }

    @Test
    fun reportsTheHostEnvironment() {
        val environment = JSONObject(NativeEvaluations.environment())

        assertTrue(environment.has("isVirtualDevice"))
        assertTrue(environment.has("hostAddress"))
    }
}
