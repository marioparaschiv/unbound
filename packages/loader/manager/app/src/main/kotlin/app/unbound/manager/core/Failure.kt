package app.unbound.manager.core

import kotlinx.serialization.Serializable

/** Why an install stopped. [retryable] decides whether the UI offers Retry or explains what the user must change. */
@Serializable
sealed interface Failure {
    val retryable: Boolean

    @Serializable
    data class Network(val message: String) : Failure {
        override val retryable get() = true
    }

    @Serializable
    data class HashMismatch(val expected: String, val actual: String) : Failure {
        override val retryable get() = true
    }

    @Serializable
    data class BadArchive(val message: String) : Failure {
        override val retryable get() = false
    }

    @Serializable
    data class WrongPackage(val expected: String, val actual: String) : Failure {
        override val retryable get() = false
    }

    @Serializable
    data class UntrustedSigner(val digest: String) : Failure {
        override val retryable get() = false
    }

    @Serializable
    data class Downgrade(val installed: Long, val incoming: Long) : Failure {
        override val retryable get() = false
    }

    @Serializable
    data object NoSplitForDevice : Failure {
        override val retryable get() = false
    }

    @Serializable
    data object InsufficientStorage : Failure {
        override val retryable get() = true
    }

    /** A PackageInstaller STATUS_FAILURE_* result. */
    @Serializable
    data class InstallerRejected(val status: Int, val message: String?) : Failure {
        override val retryable get() = status in RETRYABLE_INSTALLER_STATUSES
    }

    /** The session ended but PackageManager does not show the expected build. */
    @Serializable
    data object NotApplied : Failure {
        override val retryable get() = true
    }
}

/** PackageInstaller.STATUS_FAILURE (1), STATUS_FAILURE_ABORTED (3, the user said no) and STATUS_FAILURE_STORAGE (6). */
private val RETRYABLE_INSTALLER_STATUSES = setOf(1, 3, 6)
