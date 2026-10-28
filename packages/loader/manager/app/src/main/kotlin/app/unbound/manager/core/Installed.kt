package app.unbound.manager.core

import kotlinx.serialization.Serializable

sealed interface InstalledPackageState {
    data object Missing : InstalledPackageState

    data class Present(
        val versionCode: Long,
        val versionName: String,
        val lastUpdateTime: Long,
        val signers: Set<String>,
        val installer: String?,
    ) : InstalledPackageState
}

@Serializable
data class InstalledFrom(val sha256: String, val lastUpdateTime: Long)
