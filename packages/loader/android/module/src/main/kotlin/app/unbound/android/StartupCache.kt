package app.unbound.android

import java.io.File

/**
 * Values startup reads out of APKs, kept between launches so a launch skips opening them.
 * Each value holds while its APK keeps the size and modification time it was read at.
 */
internal class StartupCache(private val file: File) {
    private val entries = HashMap<String, Pair<String, String>>()
    private var changed = false

    init {
        runCatching {
            if (file.isFile) {
                file.forEachLine { line ->
                    val parts = line.split('\t', limit = 3)
                    if (parts.size == 3) entries[parts[0]] = parts[1] to parts[2]
                }
            }
        }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to read the startup cache ${file.path}", it) }
    }

    /** The value cached for [name] while [apk] is unchanged. */
    fun get(name: String, apk: File): String? = entries[name]?.takeIf { it.first == stamp(apk) }?.second

    fun put(name: String, apk: File, value: String) {
        entries[name] = stamp(apk) to value
        changed = true
    }

    /** The cached value of [name] for [apk], or [read]'s result; a null result is not cached. */
    fun value(name: String, apk: File, read: () -> String?): String? =
        get(name, apk) ?: read()?.also { put(name, apk, it) }

    private fun stamp(apk: File): String = "${apk.path}:${apk.length()}:${apk.lastModified()}"

    fun save() {
        if (!changed) return
        runCatching {
            val temporary = File(file.path + ".tmp")
            temporary.writeText(entries.entries.joinToString("\n") { (name, entry) -> "$name\t${entry.first}\t${entry.second}" })
            if (!temporary.renameTo(file)) error("rename failed")
            changed = false
        }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to save the startup cache ${file.path}", it) }
    }
}
