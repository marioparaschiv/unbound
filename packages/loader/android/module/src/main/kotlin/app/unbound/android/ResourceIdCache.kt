package app.unbound.android

import java.io.File

internal class ResourceIdCache(private val file: File, private val build: String) {
    private val ids = HashMap<String, Int>()
    private var changed = false

    init {
        runCatching {
            if (file.isFile) {
                val lines = file.readLines()
                if (lines.firstOrNull() == build) {
                    lines.drop(1).forEach { line ->
                        val parts = line.split('\t', limit = 2)
                        parts.getOrNull(1)?.toIntOrNull()?.let { ids[parts[0]] = it }
                    }
                }
            }
        }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to read the resource id cache ${file.path}", it) }
    }

    fun id(type: String, name: String, lookup: () -> Int): Int = synchronized(this) {
        ids.getOrPut("$type/$name") {
            changed = true
            lookup()
        }
    }

    fun save() {
        synchronized(this) { saveChanges() }
    }

    private fun saveChanges() {
        if (!changed) return
        runCatching {
            val temporary = File(file.path + ".tmp")
            temporary.writeText((listOf(build) + ids.map { (key, id) -> "$key\t$id" }).joinToString("\n"))
            if (!temporary.renameTo(file)) error("rename failed")
            changed = false
        }.onFailure { Logger.error(LogCategory.DEFAULT, "Failed to save the resource id cache ${file.path}", it) }
    }
}
