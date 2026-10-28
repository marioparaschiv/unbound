package app.unbound.manager.core

import kotlinx.serialization.Serializable

/** What PackageManager says right now. Read live every time, never persisted. */
sealed interface InstalledPackageState {
    data object Missing : InstalledPackageState

    data class Present(
        val versionCode: Long,
        val versionName: String,
        /** PackageInfo.lastUpdateTime. Ties a persisted [InstalledFrom] to these exact bits. */
        val lastUpdateTime: Long,
        /** SHA-256 hex of every signer cert. */
        val signers: Set<String>,
        val installer: String?,
    ) : InstalledPackageState
}

/** The asset the manager last installed for a target. Trusted only while lastUpdateTime still matches. */
@Serializable
data class InstalledFrom(val sha256: String, val lastUpdateTime: Long)
