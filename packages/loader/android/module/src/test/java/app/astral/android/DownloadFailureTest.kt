package app.astral.android

import org.junit.Assert.assertEquals
import org.junit.Test
import java.net.ConnectException
import java.net.SocketTimeoutException

class DownloadFailureTest {
    @Test
    fun namesTheExceptionAndItsMessage() {
        assertEquals(
            "ConnectException: Failed to connect to /127.0.0.1:9",
            NativeBridge.downloadFailureReason(ConnectException("Failed to connect to /127.0.0.1:9")),
        )
    }

    @Test
    fun keepsTheExceptionNameWithoutAMessage() {
        assertEquals("SocketTimeoutException", NativeBridge.downloadFailureReason(SocketTimeoutException()))
    }
}
