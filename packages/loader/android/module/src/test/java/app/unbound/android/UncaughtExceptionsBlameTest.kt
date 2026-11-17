package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Test

class UncaughtExceptionsBlameTest {
    @Test
    fun aHookOnTheStackNamesItsPlugin() {
        assertEquals(
            " (through Chat Bubbles's hook on MessageView.onLayout)",
            UncaughtExceptions.blameText("Chat Bubbles", "MessageView.onLayout"),
        )
    }
}
