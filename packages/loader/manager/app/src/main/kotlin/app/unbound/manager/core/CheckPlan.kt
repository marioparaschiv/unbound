package app.unbound.manager.core

import kotlinx.serialization.Serializable

/** One tracked target as the periodic check sees it. */
data class Checked(val target: Target, val installed: InstalledPackageState, val decision: UpdateDecision, val record: TargetRecord)

/** What the periodic check does about one target's new build. Each build gets one action, recorded in notifiedSha256. */
sealed interface CheckAction {
    val target: Target
    val update: UpdateDecision.Available

    /** Post "available" with an Update action. */
    data class Notify(override val target: Target, override val update: UpdateDecision.Available) : CheckAction

    /** Start the install unattended. Android lets the installer of record update without a prompt. */
    data class Install(override val target: Target, override val update: UpdateDecision.Available) : CheckAction
}

/**
 * @param self this app's package name: only a package it installed can be updated without a prompt.
 * A target with an install running is skipped and reconsidered by the next check.
 */
fun planCheck(targets: List<Checked>, autoUpdate: Boolean, self: String): List<CheckAction> = targets.mapNotNull { checked ->
    val update = checked.decision as? UpdateDecision.Available ?: return@mapNotNull null
    val phase = checked.record.phase

    if (update.latest.asset.sha256 == checked.record.notifiedSha256 || phase.inFlight) return@mapNotNull null

    val ours = (checked.installed as? InstalledPackageState.Present)?.installer == self

    if (autoUpdate && ours && phase == Phase.Idle) {
        CheckAction.Install(checked.target, update)
    } else {
        CheckAction.Notify(checked.target, update)
    }
}

/** The result of the last release check, shown on Home. */
@Serializable
data class LastCheck(
    /** Epoch millis. */
    val at: Long,
    val outcome: CheckOutcome,
)

@Serializable
sealed interface CheckOutcome {
    /** [updates] counts tracked targets with a newer build. */
    @Serializable
    data class Checked(val updates: Int) : CheckOutcome

    @Serializable
    data object RateLimited : CheckOutcome

    @Serializable
    data class Failed(val message: String) : CheckOutcome
}
