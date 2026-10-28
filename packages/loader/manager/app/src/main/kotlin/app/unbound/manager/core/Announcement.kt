package app.unbound.manager.core

/** What a phase change tells the user through a notification. */
sealed interface Announcement {
    data class Landed(val release: Release, val firstInstall: Boolean) : Announcement

    data class Failed(val release: Release, val failure: Failure) : Announcement
}

/** Called with the phases around one accepted event, so a resume that repeats a phase announces nothing. */
fun announcement(before: Phase, after: Phase): Announcement? = when {
    before is Phase.Confirming && after == Phase.Idle ->
        Announcement.Landed(before.artifact.release, firstInstall = before.artifact.previousVersionCode == null)

    after is Phase.Failed -> Announcement.Failed(after.release, after.failure)

    else -> null
}
