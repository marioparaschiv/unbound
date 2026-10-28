package app.unbound.manager.core

import kotlinx.serialization.Serializable

data class Checked(val target: Target, val installed: InstalledPackageState, val decision: UpdateDecision, val record: TargetRecord)

sealed interface CheckAction {
    val target: Target
    val update: UpdateDecision.Available

    data class Notify(override val target: Target, override val update: UpdateDecision.Available) : CheckAction

    data class Install(override val target: Target, override val update: UpdateDecision.Available) : CheckAction
}

/**
 * @param self this app's package name: only a package it installed can be updated without a prompt.
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

@Serializable
data class LastCheck(val at: Long, val outcome: CheckOutcome)

@Serializable
sealed interface CheckOutcome {
    @Serializable
    data class Checked(val updates: Int) : CheckOutcome

    @Serializable
    data object RateLimited : CheckOutcome

    @Serializable
    data class Failed(val message: String) : CheckOutcome
}
