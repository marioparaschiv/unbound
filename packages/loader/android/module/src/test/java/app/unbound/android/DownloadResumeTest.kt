package app.unbound.android

import com.sun.net.httpserver.HttpServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test
import java.io.File
import java.net.InetSocketAddress
import java.nio.file.Files

class DownloadResumeTest {
    private val body = "0123456789".repeat(100).toByteArray()
    private val etag = "\"build-1\""
    private lateinit var server: HttpServer
    private lateinit var directory: File
    private val ranges = mutableListOf<String?>()

    @Before
    fun start() {
        directory = Files.createTempDirectory("unbound-download").toFile()
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/unbound.bundle") { exchange ->
            val range = exchange.requestHeaders.getFirst("Range")
            ranges += range
            exchange.responseHeaders.add("ETag", etag)
            val from = range?.removePrefix("bytes=")?.removeSuffix("-")?.toIntOrNull()
            if (from != null && exchange.requestHeaders.getFirst("If-Range") == etag) {
                exchange.sendResponseHeaders(206, (body.size - from).toLong())
                exchange.responseBody.use { it.write(body, from, body.size - from) }
            } else {
                exchange.sendResponseHeaders(200, body.size.toLong())
                exchange.responseBody.use { it.write(body) }
            }
        }
        server.start()
    }

    @After
    fun stop() {
        server.stop(0)
        directory.deleteRecursively()
    }

    private fun download(destination: File) = NativeBridge.download(
        "http://127.0.0.1:${server.address.port}/unbound.bundle",
        destination.path,
        emptyArray(),
        emptyArray(),
        5_000,
        5_000,
        10_000,
    )

    @Test
    fun resumesAPartialDownloadFromWhereItStopped() {
        val destination = File(directory, "unbound.bundle.candidate")
        File("${destination.path}.download").writeBytes(body.copyOf(400))
        File("${destination.path}.download.etag").writeText(etag)

        val result = download(destination)

        assertEquals("200", result?.get(0))
        assertEquals("bytes=400-", ranges.single())
        assertEquals(body.toList(), destination.readBytes().toList())
        assertFalse(File("${destination.path}.download.etag").exists())
    }

    @Test
    fun startsOverWhenThePartialBelongsToAnotherBuild() {
        val destination = File(directory, "unbound.bundle.candidate")
        File("${destination.path}.download").writeBytes("stale".toByteArray())
        File("${destination.path}.download.etag").writeText("\"build-0\"")

        assertEquals("200", download(destination)?.get(0))
        assertEquals(body.toList(), destination.readBytes().toList())
    }
}
