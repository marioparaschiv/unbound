package app.unbound.android

import android.content.Context
import java.io.File

object ModuleVersions {
    private val appArchive = Regex("""^/data/app/(?:[^/]+/)?([A-Za-z][\w.]*)-[^/]*/base\.apk$""")

    fun archives(maps: String, ownPackage: String): Map<String, String> =
        maps.lineSequence()
            .mapNotNull { line -> line.indexOf('/').takeIf { it >= 0 }?.let { line.substring(it).trim() } }
            .mapNotNull { path -> appArchive.find(path)?.let { it.groupValues[1] to path } }
            .filter { (pkg, _) -> pkg != ownPackage }
            .toMap()

    private var cached: Map<String, String>? = null

    fun versions(context: Context): Map<String, String> = cached ?: runCatching {
        val maps = File("/proc/self/maps").readText()
        archives(maps, context.packageName).mapNotNull { (pkg, path) ->
            context.packageManager.getPackageArchiveInfo(path, 0)?.versionName?.let { pkg to it }
        }.toMap()
    }.getOrDefault(emptyMap()).also { cached = it }
}
