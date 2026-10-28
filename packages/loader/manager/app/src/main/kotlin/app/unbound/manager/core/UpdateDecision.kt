package app.unbound.manager.core

/** What the user should be offered for one target. Pure output of [decide]; never persisted. */
sealed interface UpdateDecision {
    /** The channel has no release carrying this target's asset. */
    data object NoRelease : UpdateDecision

    data class NotInstalled(val latest: Release) : UpdateDecision

    /** [current] is null when the installed build is not one the manager can name. */
    data class UpToDate(val current: Release?) : UpdateDecision

    /** [skipped] is every release newer than the installed one, newest first; [latest] is its first. */
    data class Available(val latest: Release, val skipped: List<Release>) : UpdateDecision

    /** Installed with a signer we do not trust (Play Store Discord). The user must uninstall first and loses local data. */
    data class Blocked(val latest: Release?, val signers: Set<String>) : UpdateDecision
}

/**
 * @param releases this target's releases on the current channel, newest first by asset.updatedAt.
 * @param trustedSigners SHA-256 digests a build of [target] may carry.
 */
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

/**
 * A tracked install whose digest is gone was replaced by a rebuild of the same tag, so only time can
 * tell. An outside install is compared by version when the target's versionName carries one.
 */
private fun Release.isNewerThan(target: Target, installed: InstalledPackageState.Present, tracked: Boolean): Boolean {
    val installedVersion = Version.parse(installed.versionName)?.takeIf { target.namesVersion && !tracked }
    return if (installedVersion != null) version > installedVersion else asset.updatedAt > installed.lastUpdateTime
}
