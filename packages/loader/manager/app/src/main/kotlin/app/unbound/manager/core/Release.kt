package app.unbound.manager.core

import kotlinx.serialization.Serializable

@Serializable
data class Release(
    val tag: String,
    val version: Version,
    val prerelease: Boolean,
    val notes: String,
    val publishedAt: Long,
    val asset: Asset,
)

@Serializable
data class Asset(val name: String, val url: String, val size: Long, val sha256: String, val updatedAt: Long)
