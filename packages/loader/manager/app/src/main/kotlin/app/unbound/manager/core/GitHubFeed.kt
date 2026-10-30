package app.unbound.manager.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.Instant

/** Every published release, parsed but not yet projected onto a target, so a channel switch needs no refetch. */
@Serializable
data class Feed(val releases: List<PublishedRelease>)

@Serializable
data class PublishedRelease(
    val tag: String,
    val title: String,
    val prerelease: Boolean,
    val notes: String,
    val publishedAt: Long,
    /** Only assets that carry a sha256 digest. */
    val assets: List<Asset>,
)

/** Parses GitHub's list-releases JSON, dropping drafts and assets without a sha256 digest. */
fun parseFeed(json: String): Feed {
    val releases = JSON.decodeFromString<List<WireRelease>>(json)
        .filter { !it.draft && it.publishedAt != null }
        .map { release ->
            PublishedRelease(
                tag = release.tag,
                title = release.name?.takeIf(String::isNotBlank) ?: release.tag,
                prerelease = release.prerelease,
                notes = release.body.orEmpty(),
                publishedAt = Instant.parse(release.publishedAt).toEpochMilli(),
                assets = release.assets.mapNotNull(WireAsset::toAsset),
            )
        }
    return Feed(releases)
}

/** This target's releases on [channel], newest first by asset.updatedAt. */
fun Feed.releasesFor(target: Target, channel: Channel): List<Release> {
    val assetName = target.assetName(channel)

    return releases.mapNotNull { release ->
        if (!target.accepts(release.title, release.prerelease, channel)) return@mapNotNull null
        val asset = release.assets.find { it.name == assetName } ?: return@mapNotNull null
        val version = Version.ofTag(release.tag) ?: return@mapNotNull null
        Release(release.tag, version, release.prerelease, release.notes, release.publishedAt, asset)
    }.sortedByDescending { it.asset.updatedAt }
}

private val JSON = Json { ignoreUnknownKeys = true }

private val SHA256_DIGEST = Regex("""^sha256:([0-9a-fA-F]{64})$""")

@Serializable
private data class WireRelease(
    @SerialName("tag_name") val tag: String,
    val name: String? = null,
    val draft: Boolean = false,
    val prerelease: Boolean = false,
    val body: String? = null,
    @SerialName("published_at") val publishedAt: String? = null,
    val assets: List<WireAsset> = emptyList(),
)

@Serializable
private data class WireAsset(
    val name: String,
    @SerialName("browser_download_url") val url: String,
    val size: Long,
    val digest: String? = null,
    @SerialName("updated_at") val updatedAt: String,
) {
    fun toAsset(): Asset? {
        val sha256 = digest?.let(SHA256_DIGEST::find)?.groupValues?.get(1)?.lowercase() ?: return null
        return Asset(name, url, size, sha256, Instant.parse(updatedAt).toEpochMilli())
    }
}
