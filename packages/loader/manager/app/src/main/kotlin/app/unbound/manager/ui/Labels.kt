package app.unbound.manager.ui

import app.unbound.manager.core.Channel
import app.unbound.manager.core.CheckOutcome
import app.unbound.manager.core.Failure
import app.unbound.manager.core.Mode
import app.unbound.manager.core.Step
import app.unbound.manager.core.Target

val Target.title: String
    get() = when (this) {
        Target.DISCORD -> "Patched Discord"
        Target.MODULE -> "LSPosed module"
        Target.MANAGER -> "Unbound Manager"
    }

val Target.shortTitle: String
    get() = when (this) {
        Target.DISCORD -> "Discord"
        Target.MODULE -> "the LSPosed module"
        Target.MANAGER -> "Unbound Manager"
    }

val Channel.label: String
    get() = name.lowercase().replaceFirstChar(Char::uppercase)

val Mode.title: String
    get() = when (this) {
        Mode.PATCHED -> "Patched Discord"
        Mode.LSPOSED -> "LSPosed module"
    }

val Step.title: String
    get() = when (this) {
        Step.DOWNLOAD -> "Download"
        Step.VERIFY -> "Verify"
        Step.INSTALL -> "Install"
        Step.CONFIRM -> "Confirm"
    }

fun CheckOutcome.label(): String = when (this) {
    is CheckOutcome.Checked -> when (updates) {
        0 -> "up to date"
        1 -> "1 update"
        else -> "$updates updates"
    }

    CheckOutcome.RateLimited -> "GitHub rate limit reached, will retry later"

    is CheckOutcome.Failed -> message
}

fun Failure.describe(): String = when (this) {
    is Failure.Network -> "The download failed: $message"
    is Failure.HashMismatch -> "The download does not match the published checksum."
    is Failure.BadArchive -> "The release file is damaged: $message"
    is Failure.WrongPackage -> "The release contains $actual instead of $expected."
    is Failure.UntrustedSigner -> "The release is not signed by Unbound (signer $digest)."
    is Failure.Downgrade -> "This build ($incoming) is older than the installed one ($installed). Uninstall first to switch down."
    Failure.NoSplitForDevice -> "The release has no build for this device's processor."
    Failure.InsufficientStorage -> "There is not enough free storage."
    is Failure.InstallerRejected -> "Android refused the install (status $status): ${message ?: "no reason given"}"
    Failure.NotApplied -> "The install finished but Android does not show the new build."
    is Failure.Unexpected -> "Something went wrong: $message"
}
