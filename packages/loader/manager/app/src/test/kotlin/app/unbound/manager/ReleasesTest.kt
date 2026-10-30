package app.unbound.manager

import com.sun.net.httpserver.HttpServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.InetSocketAddress

class ReleasesTest {
    private val requests = mutableListOf<Pair<String, String?>>()
    private var respond: (etag: String?) -> Triple<Int, Map<String, String>, String> = { Triple(200, emptyMap(), "[]") }
    private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
        createContext("/releases") { exchange ->
            val etag = exchange.requestHeaders.getFirst("If-None-Match")
            requests += exchange.requestURI.query to etag
            val (status, headers, body) = respond(etag)
            headers.forEach { (name, value) -> exchange.responseHeaders.add(name, value) }
            val bytes = body.toByteArray()
            exchange.sendResponseHeaders(status, if (bytes.isEmpty()) -1 else bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        start()
    }
    private val url = "http://127.0.0.1:${server.address.port}/releases"
    private val fixture = javaClass.getResource("/github-releases.json")!!.readText()

    @After
    fun stop() = server.stop(0)

    @Test
    fun `a fresh list is parsed and its ETag replayed so an unchanged list costs a 304`() {
        respond = { etag -> if (etag == "\"v1\"") Triple(304, emptyMap(), "") else Triple(200, mapOf("ETag" to "\"v1\""), fixture) }

        val fresh = fetchReleases(url, null)

        assertTrue(fresh is FetchResult.Fresh)
        fresh as FetchResult.Fresh
        assertEquals("\"v1\"", fresh.cache.etag)
        assertTrue(fresh.cache.feed.releases.any { it.tag == "loader-v353.1-android-alpha" })
        assertEquals(FetchResult.NotModified, fetchReleases(url, fresh.cache))
        assertEquals(listOf("per_page=100" to null, "per_page=100" to "\"v1\""), requests)
    }

    @Test
    fun `an exhausted rate limit reports when it resets`() {
        respond = { Triple(403, mapOf("x-ratelimit-remaining" to "0", "x-ratelimit-reset" to "1800000000"), "{}") }

        assertEquals(FetchResult.RateLimited(1_800_000_000_000), fetchReleases(url, null))
    }

    @Test
    fun `a forbidden response with quota left is a failure, not a rate limit`() {
        respond = { Triple(403, mapOf("x-ratelimit-remaining" to "42"), "{}") }

        assertTrue(fetchReleases(url, null) is FetchResult.Failed)
    }

    @Test
    fun `an unreachable server is a failure`() {
        server.stop(0)

        assertTrue(fetchReleases(url, null) is FetchResult.Failed)
    }
}
