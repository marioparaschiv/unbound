package app.unbound.manager

import app.unbound.manager.core.Feed
import app.unbound.manager.core.parseFeed
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.time.format.DateTimeParseException

/** The last good feed and the ETag it came with, persisted by the caller so a 304 costs no rate limit. */
@Serializable
data class FeedCache(val etag: String?, val feed: Feed)

sealed interface FetchResult {
    data class Fresh(val cache: FeedCache) : FetchResult

    /** The caller's cache is still current. */
    data object NotModified : FetchResult

    /** [resetAt] is epoch millis from x-ratelimit-reset, null when GitHub did not say. */
    data class RateLimited(val resetAt: Long?) : FetchResult

    data class Failed(val message: String) : FetchResult
}

/** Blocking GET of the releases list. Sends If-None-Match when [cache] has an ETag. */
fun fetchReleases(url: String, cache: FeedCache?): FetchResult {
    val connection = URL(url + (if ('?' in url) "&" else "?") + "per_page=100").openConnection() as HttpURLConnection

    return try {
        connection.connectTimeout = TIMEOUT_MILLIS
        connection.readTimeout = TIMEOUT_MILLIS
        connection.setRequestProperty("Accept", "application/vnd.github+json")
        cache?.etag?.let { connection.setRequestProperty("If-None-Match", it) }

        when (val status = connection.responseCode) {
            HttpURLConnection.HTTP_OK -> {
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                FetchResult.Fresh(FeedCache(connection.getHeaderField("ETag"), parseFeed(body)))
            }

            HttpURLConnection.HTTP_NOT_MODIFIED -> FetchResult.NotModified

            HttpURLConnection.HTTP_FORBIDDEN, HTTP_TOO_MANY_REQUESTS -> {
                val remaining = connection.getHeaderField("x-ratelimit-remaining")
                val resetAt = connection.getHeaderField("x-ratelimit-reset")?.toLongOrNull()?.times(1000)
                if (status == HTTP_TOO_MANY_REQUESTS || remaining == "0") {
                    FetchResult.RateLimited(resetAt)
                } else {
                    FetchResult.Failed("GitHub returned HTTP $status")
                }
            }

            else -> FetchResult.Failed("GitHub returned HTTP $status")
        }
    } catch (error: IOException) {
        FetchResult.Failed("Could not reach GitHub: ${error.message}")
    } catch (error: SerializationException) {
        FetchResult.Failed("GitHub returned a release list the manager cannot read: ${error.message}")
    } catch (error: DateTimeParseException) {
        FetchResult.Failed("GitHub returned a release list the manager cannot read: ${error.message}")
    } finally {
        connection.disconnect()
    }
}

private const val TIMEOUT_MILLIS = 15_000
private const val HTTP_TOO_MANY_REQUESTS = 429
