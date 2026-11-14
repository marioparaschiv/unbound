package app.unbound.android

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONObject
import java.io.File
import java.util.zip.ZipFile

internal data class AnimatedIconTiming(val durations: List<Long>, val rest: Int)

internal object AnimatedIconFrames {
    const val ID = "UnboundAnimated"
    const val NAME = "Unbound (Animated)"
    const val EXTRA = "unbound.animatedIcon"
    private const val DIRECTORY = "assets/animated-icon/"
    private const val TIMING = DIRECTORY + "frames.json"
    private const val PREVIEW = DIRECTORY + "UnboundAnimated.gif"

    fun frameEntry(index: Int): String = DIRECTORY + "UnboundAnimated%02d60x60@3x.png".format(index)

    fun parseTiming(json: String): AnimatedIconTiming? = runCatching {
        val root = JSONObject(json)
        val list = root.getJSONArray("durations")
        val durations = (0 until list.length()).map { list.getLong(it).coerceAtLeast(16) }
        val rest = root.optInt("rest", durations.lastIndex)
        AnimatedIconTiming(durations, rest.coerceIn(0, durations.lastIndex)).takeIf { durations.isNotEmpty() }
    }.getOrNull()

    fun timing(moduleAPK: String): AnimatedIconTiming? = ZipFile(moduleAPK).use { archive ->
        val entry = archive.getEntry(TIMING) ?: return null
        parseTiming(archive.getInputStream(entry).bufferedReader().use { it.readText() })
    }

    fun bitmaps(moduleAPK: String, count: Int): List<Bitmap>? = ZipFile(moduleAPK).use { archive ->
        (0 until count).map { index ->
            val entry = archive.getEntry(frameEntry(index)) ?: return null
            archive.getInputStream(entry).use(BitmapFactory::decodeStream) ?: return null
        }
    }

    fun extractRestFrame(moduleAPK: String, destination: File): File? = extract(
        moduleAPK,
        timing(moduleAPK)?.let {
            frameEntry(it.rest)
        },
        destination,
    )

    fun extractPreview(moduleAPK: String, destination: File): File? = extract(moduleAPK, PREVIEW, destination)

    private fun extract(moduleAPK: String, name: String?, destination: File): File? {
        if (name == null) return null
        if (destination.isFile && destination.lastModified() >= File(moduleAPK).lastModified()) return destination
        destination.parentFile?.mkdirs()
        ZipFile(moduleAPK).use { archive ->
            val entry = archive.getEntry(name) ?: return null
            archive.getInputStream(entry).use { input -> destination.outputStream().use { input.copyTo(it) } }
        }
        return destination
    }
}
