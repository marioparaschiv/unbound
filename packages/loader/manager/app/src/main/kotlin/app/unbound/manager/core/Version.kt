package app.unbound.manager.core

import kotlinx.serialization.Serializable

/** A dotted numeric version such as Discord's 353.1 or the manager's 1.2.0, compared part by part. */
@Serializable
data class Version(val parts: List<Int>) : Comparable<Version> {
    override fun compareTo(other: Version): Int {
        for (index in 0 until maxOf(parts.size, other.parts.size)) {
            val difference = parts.getOrElse(index) { 0 } - other.parts.getOrElse(index) { 0 }
            if (difference != 0) return difference
        }
        return 0
    }

    override fun toString(): String = parts.joinToString(".")

    companion object {
        private val LEADING = Regex("""^\d+(\.\d+)*""")

        /** The leading version of [text]: "353.1 - Alpha" and "353.1" both give 353.1. */
        fun parse(text: String): Version? = LEADING.find(text.trim())?.value?.split(".")?.map(String::toInt)?.let(::Version)

        /** The version in a release tag: "loader-v353.1-android-alpha" gives 353.1, "manager-v1.2.0" gives 1.2.0. */
        fun ofTag(tag: String): Version? = tag.substringAfter("-v", "").takeIf(String::isNotEmpty)?.let(::parse)
    }
}
