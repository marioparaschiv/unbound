package app.unbound.manager.core

const val TRUSTED = "3923c381141ea804a1a311c69b616ac9c360d4fb0dccb5fbcd09a6b8b78842c5"
const val PLAY_STORE = "3c39d23c00000000000000000000000000000000000000000000000000000000"

fun release(tag: String, sha256: String, updatedAt: Long, asset: String = "Unbound-alpha.apks"): Release = Release(
    tag = tag,
    version = Version.ofTag(tag)!!,
    prerelease = true,
    notes = "",
    publishedAt = updatedAt,
    asset = Asset(asset, "https://example.invalid/$tag/$asset", 1, sha256, updatedAt),
)

fun present(versionName: String, lastUpdateTime: Long, versionCode: Long = 1, signer: String = TRUSTED) = InstalledPackageState.Present(
    versionCode = versionCode,
    versionName = versionName,
    lastUpdateTime = lastUpdateTime,
    signers = setOf(signer),
    installer = "app.unbound.manager",
)
