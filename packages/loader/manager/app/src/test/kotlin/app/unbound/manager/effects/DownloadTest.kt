package app.unbound.manager.effects

import app.unbound.manager.core.Asset
import app.unbound.manager.core.Event
import app.unbound.manager.core.Failure
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.net.InetSocketAddress
import java.security.MessageDigest

class DownloadTest {
    @get:Rule
    val temp = TemporaryFolder()

    private val body = ByteArray(700_000) { (it * 31).toByte() }
    private val digest = MessageDigest.getInstance("SHA-256").digest(body).joinToString("") { "%02x".format(it) }
    private val ranges = mutableListOf<String?>()
    private var honourRange = true
    private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
        createContext("/asset") { exchange ->
            val range = exchange.requestHeaders.getFirst("Range")
            ranges += range
            val from = range?.takeIf { honourRange }?.removePrefix("bytes=")?.removeSuffix("-")?.toInt() ?: 0
            val bytes = body.copyOfRange(from, body.size)
            exchange.sendResponseHeaders(if (from > 0) 206 else 200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        start()
    }
    private val asset = Asset("Unbound-alpha.apks", "http://127.0.0.1:${server.address.port}/asset", body.size.toLong(), digest, 1)

    @After
    fun stop() = server.stop(0)

    private fun run(asset: Asset = this.asset, dir: File = temp.root) = runBlocking { download(asset, dir, { _, _ -> }, {}) }

    private fun partial(bytes: Int) = File(temp.root, "$digest.part").writeBytes(body.copyOfRange(0, bytes))

    @Test
    fun `a fresh download lands under its digest`() {
        assertEquals(Event.Downloaded, run())
        assertArrayEquals(body, archiveFile(temp.root, asset).readBytes())
        assertEquals(listOf<String?>(null), ranges)
    }

    @Test
    fun `a partial download resumes from the byte it stopped at`() {
        partial(300_000)

        assertEquals(Event.Downloaded, run())
        assertEquals(listOf<String?>("bytes=300000-"), ranges)
        assertArrayEquals(body, archiveFile(temp.root, asset).readBytes())
    }

    @Test
    fun `a server that ignores Range restarts the file instead of appending to it`() {
        honourRange = false
        partial(300_000)

        assertEquals(Event.Downloaded, run())
        assertArrayEquals(body, archiveFile(temp.root, asset).readBytes())
    }

    @Test
    fun `a finished download is not fetched again`() {
        run()
        ranges.clear()

        assertEquals(Event.Downloaded, run())
        assertEquals(emptyList<String?>(), ranges)
    }

    @Test
    fun `a file that does not match the digest is rejected and thrown away`() {
        val wrong = asset.copy(sha256 = "0".repeat(64))

        assertEquals(Event.Fail(Failure.HashMismatch("0".repeat(64), digest)), run(wrong))
        assertFalse(archiveFile(temp.root, wrong).exists())
        assertFalse(File(temp.root, "${wrong.sha256}.part").exists())
    }

    @Test
    fun `an unreachable server is a retryable network failure that keeps the partial file`() {
        partial(300_000)
        server.stop(0)

        val result = run()

        assertEquals(true, (result as Event.Fail).failure is Failure.Network)
        assertEquals(300_000L, File(temp.root, "$digest.part").length())
    }
}
