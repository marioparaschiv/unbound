package app.unbound.manager.core

sealed interface UpdateDecision {
    data object NoRelease : UpdateDecision

    data class NotInstalled(val latest: Release) : UpdateDecision

    data class UpToDate(val current: Release?) : UpdateDecision

    data class Available(val latest: Release, val skipped: List<Release>) : UpdateDecision

    data class Blocked(val latest: Release?, val signers: Set<String>) : UpdateDecision
}

fun decide(
    target: Target,
    installed: InstalledPackageState,
    installedFrom: InstalledFrom?,
    releases: List<Release>,
    trustedSigners: Set<String>,
): UpdateDecision {
    val latest = releases.firstOrNull()

    if (installed !is InstalledPackageState.Present) {
        return latest?.let(UpdateDecision::NotInstalled) ?: UpdateDecision.NoRelease
    }
    if (installed.signers.none(trustedSigners::contains)) return UpdateDecision.Blocked(latest, installed.signers)
    if (latest == null) return UpdateDecision.NoRelease

    val tracked = installedFrom?.takeIf { it.lastUpdateTime == installed.lastUpdateTime }
    val index = tracked?.let { from -> releases.indexOfFirst { it.asset.sha256 == from.sha256 } } ?: -1
    val newer = if (index >= 0) releases.take(index) else releases.filter { it.isNewerThan(target, installed, tracked != null) }

    return if (newer.isEmpty()) UpdateDecision.UpToDate(releases.getOrNull(index)) else UpdateDecision.Available(newer.first(), newer)
}

private fun Release.isNewerThan(target: Target, installed: InstalledPackageState.Present, tracked: Boolean): Boolean {
    val installedVersion = Version.parse(installed.versionName)?.takeIf { target.versionNameIsReleaseVersion && !tracked }
    return if (installedVersion != null) version > installedVersion else asset.updatedAt > installed.lastUpdateTime
}
