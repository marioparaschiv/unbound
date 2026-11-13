package app.unbound.android

import android.app.DownloadManager
import android.net.Uri
import org.json.JSONObject
import java.io.File

object BackgroundDownloads {
    private const val PENDING_SUFFIX = ".background.pending"
    private const val STAGED_SUFFIX = ".background.staged"
    private const val DIRECTORY = "unbound-downloads"
    private const val TITLE = "Unbound update"

    private data class Pending(val id: Long, val url: String)

    private fun manager(): DownloadManager? = Platform.application()?.getSystemService(DownloadManager::class.java)

    private fun readPending(file: File): Pending? = runCatching {
        val value = JSONObject(file.readText())
        Pending(value.getLong("id"), value.getString("url"))
    }.getOrNull()

    private fun statusOf(manager: DownloadManager, id: Long): Pair<Int, String?>? =
        manager.query(DownloadManager.Query().setFilterById(id))?.use { cursor ->
            if (!cursor.moveToFirst()) return@use null
            val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            val local = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI))
            status to local
        }

    private fun isActive(status: Int): Boolean =
        status == DownloadManager.STATUS_PENDING ||
            status == DownloadManager.STATUS_RUNNING ||
            status == DownloadManager.STATUS_PAUSED

    @JvmStatic
    fun start(url: String, destination: String, headersJSON: String) {
        runCatching {
            val context = Platform.application() ?: return
            val manager = manager() ?: return
            val pending = File(destination + PENDING_SUFFIX)
            readPending(pending)?.let { previous ->
                val status = statusOf(manager, previous.id)?.first
                if (previous.url == url && status != null && isActive(status)) return
                manager.remove(previous.id)
            }
            val name = File(destination).name
            context.getExternalFilesDir(DIRECTORY)?.let { File(it, name).delete() }
            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle(TITLE)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(context, DIRECTORY, name)
            val headers = JSONObject(headersJSON)
            headers.keys().forEach { request.addRequestHeader(it, headers.getString(it)) }
            val id = manager.enqueue(request)
            pending.writeText(JSONObject().put("id", id).put("url", url).toString())
            Logger.info(LogCategory.UPDATER, "Continuing the download of $url in the background")
        }.onFailure { Logger.error(LogCategory.UPDATER, "Failed to continue the download of $url in the background", it) }
    }

    @JvmStatic
    fun collect(destination: String): String? = runCatching {
        val pending = File(destination + PENDING_SUFFIX)
        val download = readPending(pending) ?: return null
        val manager = manager() ?: return null
        val (status, local) = statusOf(manager, download.id) ?: (DownloadManager.STATUS_FAILED to null)
        if (isActive(status)) return null
        pending.delete()
        val source = local?.let { Uri.parse(it).path }?.let(::File)
        if (status != DownloadManager.STATUS_SUCCESSFUL || source == null || !source.isFile) {
            manager.remove(download.id)
            return null
        }
        val staged = File(destination + STAGED_SUFFIX)
        source.copyTo(staged, overwrite = true)
        manager.remove(download.id)
        JSONObject().put("url", download.url).put("path", staged.path).toString()
    }.onFailure { Logger.error(LogCategory.UPDATER, "Failed to collect the background download for $destination", it) }.getOrNull()
}
