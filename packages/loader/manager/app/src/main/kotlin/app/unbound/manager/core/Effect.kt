package app.unbound.manager.core

sealed interface Effect {
    data class Download(val release: Release) : Effect

    data class Verify(val release: Release) : Effect

    data class OpenSession(val artifact: Artifact) : Effect

    data class Commit(val sessionId: Int) : Effect

    data class AwaitUser(val sessionId: Int) : Effect

    data object Confirm : Effect

    data class Cleanup(val keepDownloads: Boolean) : Effect
}

fun Phase.effect(): Effect = when (this) {
    Phase.Idle -> Effect.Cleanup(keepDownloads = false)
    is Phase.Downloading -> Effect.Download(release)
    is Phase.Verifying -> Effect.Verify(release)
    is Phase.Committing -> Effect.OpenSession(artifact)
    is Phase.Committed -> Effect.Commit(sessionId)
    is Phase.AwaitingUser -> Effect.AwaitUser(sessionId)
    is Phase.Confirming -> Effect.Confirm
    is Phase.Failed -> Effect.Cleanup(keepDownloads = true)
}

val Phase.cancellable: Boolean get() = TargetRecord(phase = this).on(Event.Cancel).phase != this

val Phase.inFlight: Boolean get() = this !is Phase.Idle && this !is Phase.Failed
