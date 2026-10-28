package app.unbound.manager.core

import kotlinx.serialization.Serializable

@Serializable
sealed interface Failure {
    @Serializable
    data class Network(val message: String) : Failure

    @Serializable
    data class HashMismatch(val expected: String, val actual: String) : Failure

    @Serializable
    data class BadArchive(val message: String) : Failure

    @Serializable
    data class WrongPackage(val expected: String, val actual: String) : Failure

    @Serializable
    data class UntrustedSigner(val digest: String) : Failure

    @Serializable
    data class Downgrade(val installed: Long, val incoming: Long) : Failure

    @Serializable
    data object NoSplitForDevice : Failure

    @Serializable
    data object InsufficientStorage : Failure

    @Serializable
    data class InstallerRejected(val status: Int, val message: String?) : Failure

    @Serializable
    data object NotApplied : Failure

    @Serializable
    data class Unexpected(val message: String) : Failure
}
