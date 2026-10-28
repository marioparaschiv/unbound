package app.unbound.manager.core

sealed interface Announcement {
    data class Landed(val release: Release, val firstInstall: Boolean) : Announcement

    data class Failed(val release: Release, val failure: Failure) : Announcement
}

fun announcement(before: Phase, after: Phase): Announcement? = when {
    before is Phase.Confirming && after == Phase.Idle ->
        Announcement.Landed(before.artifact.release, firstInstall = before.artifact.previousVersionCode == null)

    after is Phase.Failed -> Announcement.Failed(after.release, after.failure)

    else -> null
}
