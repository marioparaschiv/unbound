package app.unbound.manager.effects

import app.unbound.manager.core.Asset
import app.unbound.manager.core.Event
import app.unbound.manager.core.Failure
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** Where [download] leaves a verified copy of [asset]. Named by digest, so a rebuild of the same tag never collides. */
fun archiveFile(dir: File, asset: Asset): File = File(dir, asset.sha256)

/**
 * Resumes into `<sha256>.part` with a Range request, then renames it to [archiveFile] once size and
 * digest match. A file already at [archiveFile] with the right digest is a no-op, so rerunning is free.
 * [progress] gets (bytes on disk, total). Cancelling the coroutine stops between chunks and keeps the part.
 */
suspend fun download(asset: Asset, dir: File, progress: (Long, Long) -> Unit, log: (String) -> Unit): Event {
    val file = archiveFile(dir, asset)

    if (file.exists()) {
        if (sha256(file) == asset.sha256) return Event.Downloaded
        file.delete()
    }

    dir.mkdirs()
    val part = File(dir, "${asset.sha256}.part")

    if (part.length() > asset.size) part.delete()

    try {
        if (part.length() < asset.size) fetch(asset, part, progress, log)
    } catch (error: IOException) {
        return Event.Fail(Failure.Network(error.message ?: error.javaClass.simpleName))
    }

    if (part.length() != asset.size) {
        return Event.Fail(Failure.Network("The download stopped at ${part.length()} of ${asset.size} bytes"))
    }

    val actual = sha256(part)

    if (actual != asset.sha256) {
        part.delete()
        return Event.Fail(Failure.HashMismatch(asset.sha256, actual))
    }
    if (!part.renameTo(file)) return Event.Fail(Failure.Unexpected("Could not move the download into place"))

    log("Downloaded ${asset.name}, sha256 $actual")
    return Event.Downloaded
}

private suspend fun fetch(asset: Asset, part: File, progress: (Long, Long) -> Unit, log: (String) -> Unit) {
    val offset = part.length()
    val connection = URL(asset.url).openConnection() as HttpURLConnection

    try {
        connection.connectTimeout = TIMEOUT_MILLIS
        connection.readTimeout = TIMEOUT_MILLIS
        if (offset > 0) connection.setRequestProperty("Range", "bytes=$offset-")

        val resumed = when (val status = connection.responseCode) {
            HttpURLConnection.HTTP_PARTIAL -> true
            HttpURLConnection.HTTP_OK -> false
            else -> throw IOException("${asset.name} returned HTTP $status")
        }
        var written = if (resumed) offset else 0L

        log(if (resumed) "Resuming ${asset.name} at byte $offset" else "Downloading ${asset.name} (${asset.size} bytes)")
        connection.inputStream.use { input ->
            FileOutputStream(part, resumed).use { output ->
                val buffer = ByteArray(BUFFER_BYTES)

                while (true) {
                    currentCoroutineContext().ensureActive()
                    val read = input.read(buffer)
                    if (read < 0) break
                    output.write(buffer, 0, read)
                    written += read
                    progress(written, asset.size)
                }
            }
        }
    } finally {
        connection.disconnect()
    }
}

/** Lowercase hex SHA-256 of [file]. */
fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")

    file.inputStream().use { input ->
        val buffer = ByteArray(BUFFER_BYTES)

        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            digest.update(buffer, 0, read)
        }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
}

private const val TIMEOUT_MILLIS = 30_000
private const val BUFFER_BYTES = 256 * 1024
