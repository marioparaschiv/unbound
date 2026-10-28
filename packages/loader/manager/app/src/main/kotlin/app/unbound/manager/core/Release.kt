package app.unbound.manager.core

import kotlinx.serialization.Serializable

/**
 * One downloadable build of one [Target]: a GitHub release projected onto the single asset that
 * target needs. Identity is [Asset.sha256], not [tag]: a rebuild reuses the tag and replaces assets.
 */
@Serializable
data class Release(
    val tag: String,
    val version: Version,
    val prerelease: Boolean,
    /** GitHub's generated "What's Changed" markdown. */
    val notes: String,
    /** Epoch millis. */
    val publishedAt: Long,
    val asset: Asset,
)

@Serializable
data class Asset(
    val name: String,
    val url: String,
    val size: Long,
    /** Lowercase hex from GitHub's "sha256:..." digest. Assets without one never reach this type. */
    val sha256: String,
    /** Epoch millis. Releases are ordered newest first by this, so a rebuild sorts to the top. */
    val updatedAt: Long,
)
