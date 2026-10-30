package app.astral.android

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.widget.ImageView
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.lang.ref.WeakReference
import java.net.URL
import java.util.LinkedHashMap
import java.util.WeakHashMap
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.FutureTask
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadFactory
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import javax.net.ssl.HttpsURLConnection

internal object NativeImageLoader {
    private const val MAX_SOURCE_LENGTH = 2048
    private const val MAX_IMAGE_BYTES = 16 * 1024 * 1024
    private const val MAX_SOURCE_DIMENSION = 65_536
    private const val MAX_IMAGE_DIMENSION = 2048
    private const val MAX_CACHE_BYTES = 24 * 1024 * 1024
    private const val MAX_PENDING_REQUESTS = 512
    private const val REQUEST_RETRY_DELAY_MILLISECONDS = 50L
    private val trustedDiscordDomains = listOf("discord.com", "discordapp.com", "discordapp.net")

    private data class Request(
        val identifier: Long,
        val source: String,
        val resolver: ContentResolver,
        val imageReference: WeakReference<ImageView>,
        var task: FutureTask<Unit>? = null,
        var submitted: Boolean = false,
    )

    private val lock = Any()
    private val requests = WeakHashMap<ImageView, Long>()
    private val pending = WeakHashMap<ImageView, Request>()
    private val cache = LinkedHashMap<String, Bitmap>(16, 0.75f, true)
    private val retryHandler = Handler(Looper.getMainLooper())
    private var nextRequest = 0L
    private var cachedBytes = 0
    private var retryScheduled = false
    private val executor = ThreadPoolExecutor(
        2,
        2,
        30,
        TimeUnit.SECONDS,
        ArrayBlockingQueue(256),
        ThreadFactory { task -> Thread(task, "astral-native-image").apply { isDaemon = true } },
        ThreadPoolExecutor.AbortPolicy(),
    )

    fun load(view: ImageView, source: String) {
        require(source.length <= MAX_SOURCE_LENGTH)
        if (source.isEmpty()) {
            clear(view)
            return
        }
        require(isSupportedSource(source))

        val request: Request?
        val cached: Bitmap?
        synchronized(lock) {
            val identifier = ++nextRequest
            requests[view] = identifier
            cancelPending(view)
            cached = cache[source]
            if (cached != null) {
                request = null
            } else {
                check(pending.size < MAX_PENDING_REQUESTS) {
                    "The Android native image request limit has been reached"
                }
                val created = Request(
                    identifier,
                    source,
                    view.context.applicationContext.contentResolver,
                    WeakReference(view),
                )
                created.task = FutureTask { load(created) }
                pending[view] = created
                request = created
            }
        }
        if (cached != null) {
            view.setImageBitmap(cached)
            return
        }

        view.setImageDrawable(null)
        submit(request ?: return)
    }

    fun clear(view: ImageView) {
        synchronized(lock) {
            requests[view] = ++nextRequest
            cancelPending(view)
        }
        view.setImageDrawable(null)
    }

    internal fun isSupportedSource(source: String): Boolean {
        if (source.isEmpty() || source.length > MAX_SOURCE_LENGTH) return false
        val uri = Uri.parse(source)
        return when (uri.scheme?.lowercase()) {
            "content" -> !uri.authority.isNullOrEmpty()

            "file" -> !uri.path.isNullOrEmpty()

            "https" -> {
                val host = uri.host?.lowercase() ?: return false
                isTrustedDiscordHost(host) && (uri.port == -1 || uri.port == 443)
            }

            else -> false
        }
    }

    private fun isTrustedDiscordHost(host: String): Boolean =
        trustedDiscordDomains.any { host == it || host.endsWith(".$it") }

    private fun cancelPending(view: ImageView) {
        val request = pending.remove(view) ?: return
        request.task?.let {
            it.cancel(false)
            executor.remove(it)
        }
    }

    private fun submit(request: Request) {
        val image = request.imageReference.get() ?: run {
            finish(request)
            return
        }
        val task = request.task ?: return
        val shouldSubmit = synchronized(lock) {
            pending[image] === request && !request.submitted
        }
        if (!shouldSubmit) return

        try {
            executor.execute(task)
            synchronized(lock) {
                if (pending[image] === request) request.submitted = true
            }
        } catch (_: RejectedExecutionException) {
            scheduleRetry()
        }
    }

    private fun scheduleRetry() {
        synchronized(lock) {
            if (retryScheduled) return
            retryScheduled = true
        }
        retryHandler.postDelayed({
            val requests = synchronized(lock) {
                retryScheduled = false
                pending.values.filter { !it.submitted }
            }
            requests.forEach(::submit)
        }, REQUEST_RETRY_DELAY_MILLISECONDS)
    }

    private fun load(request: Request) {
        val bitmap = try {
            readBitmap(request.resolver, Uri.parse(request.source))
        } catch (_: Exception) {
            null
        }
        if (bitmap != null) {
            synchronized(lock) {
                cache.put(request.source, bitmap)?.let { cachedBytes -= it.byteCount }
                cachedBytes += bitmap.byteCount
                trimCache()
            }
        }
        finish(request)
        if (bitmap == null) return

        request.imageReference.get()?.post {
            val image = request.imageReference.get() ?: return@post
            val current = synchronized(lock) { requests[image] == request.identifier }
            if (current) image.setImageBitmap(bitmap)
        }
    }

    private fun finish(request: Request) {
        val image = request.imageReference.get() ?: return
        synchronized(lock) {
            if (pending[image] === request) pending.remove(image)
        }
    }

    private fun readBitmap(resolver: ContentResolver, uri: Uri): Bitmap? {
        val bytes = when (uri.scheme?.lowercase()) {
            "content", "file" -> resolver.openInputStream(uri)?.use(::readBounded)
            "https" -> readHttps(uri)
            else -> null
        } ?: return null
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        if (bounds.outWidth > MAX_SOURCE_DIMENSION || bounds.outHeight > MAX_SOURCE_DIMENSION) return null
        val sample = sampleSize(bounds.outWidth, bounds.outHeight)
        return BitmapFactory.decodeByteArray(
            bytes,
            0,
            bytes.size,
            BitmapFactory.Options().apply { inSampleSize = sample },
        )
    }

    private fun readHttps(uri: Uri): ByteArray? {
        if (!isSupportedSource(uri.toString())) return null
        val connection = URL(uri.toString()).openConnection() as? HttpsURLConnection ?: return null
        connection.connectTimeout = 5_000
        connection.readTimeout = 8_000
        connection.useCaches = true
        connection.instanceFollowRedirects = false
        return try {
            if (connection.responseCode != HttpsURLConnection.HTTP_OK) return null
            if (connection.contentLengthLong > MAX_IMAGE_BYTES) return null
            connection.inputStream.use(::readBounded)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(input: InputStream): ByteArray? {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        var total = 0
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            if (total > MAX_IMAGE_BYTES) return null
            output.write(buffer, 0, count)
        }
        return output.toByteArray()
    }

    private fun sampleSize(width: Int, height: Int): Int {
        var sample = 1
        while (width / sample > MAX_IMAGE_DIMENSION || height / sample > MAX_IMAGE_DIMENSION) {
            sample *= 2
        }
        return sample
    }

    private fun trimCache() {
        val iterator = cache.entries.iterator()
        while (cachedBytes > MAX_CACHE_BYTES && iterator.hasNext()) {
            cachedBytes -= iterator.next().value.byteCount
            iterator.remove()
        }
    }
}
