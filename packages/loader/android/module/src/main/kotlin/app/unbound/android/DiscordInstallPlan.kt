package app.unbound.android

import org.json.JSONArray

/** One gzipped split of a patched Discord build, as `GET /api/v1/loader/android-builds` lists it. */
data class BuildSplit(val name: String, val url: String, val sha256: String, val size: Long, val compressedSize: Long)

/** What an install writes: [downloads] replace their installed splits; with [inherit], every other installed split is kept. */
data class DiscordInstallPlan(val downloads: List<BuildSplit>, val inherit: Boolean) {
    val downloadBytes: Long get() = downloads.sumOf { it.compressedSize }

    companion object {
        private val SHA256 = Regex("^[0-9a-f]{64}$")
        private val SPLIT_NAME = Regex("^(base|config\\.[a-z0-9_]{1,32})$")
        private const val HTTPS = "https://"
        private const val HTTP = "http://"

        fun parseSplits(json: String): List<BuildSplit> {
            val array = JSONArray(json)
            return List(array.length()) { index ->
                val split = array.getJSONObject(index)
                BuildSplit(
                    name = split.getString("name"),
                    url = split.getString("url"),
                    sha256 = split.getString("sha256"),
                    size = split.getLong("size"),
                    compressedSize = split.getLong("compressedSize"),
                ).also {
                    require(SPLIT_NAME.matches(it.name)) { "Invalid split name ${it.name}" }
                    require(SHA256.matches(it.sha256)) { "Invalid sha256 for split ${it.name}" }
                    require(it.url.startsWith(HTTPS) || it.url.startsWith(HTTP)) { "Invalid URL for split ${it.name}" }
                    require(it.size > 0 && it.compressedSize > 0) { "Invalid size for split ${it.name}" }
                }
            }
        }

        /**
         * Plans moving the installed splits to [build]: the device needs base plus every config split it has now,
         * and only splits whose SHA-256 differs from the installed one are downloaded.
         */
        fun plan(installed: Map<String, String?>, build: List<BuildSplit>): DiscordInstallPlan {
            val byName = build.associateBy { it.name }
            val needed = (installed.keys + "base").distinct()
            val missing = needed.filter { it !in byName }
            require(missing.isEmpty()) { "This build has no ${missing.joinToString()} split for this device" }
            val downloads = needed.mapNotNull { name -> byName.getValue(name).takeIf { it.sha256 != installed[name] } }
            return DiscordInstallPlan(downloads, inherit = downloads.size < needed.size)
        }
    }
}
