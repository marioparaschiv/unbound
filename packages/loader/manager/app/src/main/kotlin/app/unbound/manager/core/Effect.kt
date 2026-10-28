package app.unbound.manager.core

/**
 * The side effect a persisted phase asks for. The runner performs it and applies the event it returns,
 * so a first run and a resume after process death are the same code. Every effect is idempotent.
 */
sealed interface Effect {
    /** Resumable download of the release asset; Downloaded once the file matches the digest. */
    data class Download(val release: Release) : Effect

    /** Unpack and check package name, signer and versionCode; Verified or Fail. */
    data class Verify(val release: Release) : Effect

    /** Abandon our sessions for the package, write every split into a new one; SessionReady. Commit waits for it to be persisted. */
    data class OpenSession(val artifact: Artifact) : Effect

    /** Session gone: SessionFinished. Not yet committed: commit it. Committed: wait for the result broadcast. */
    data class Commit(val sessionId: Int) : Effect

    /** Session gone: SessionFinished. Confirm Intent still held by this process or a notification: wait. Lost: Recommit. */
    data class AwaitUser(val sessionId: Int) : Effect

    /** Read the installed package; Observed. */
    data object Confirm : Effect

    /** Abandon our sessions for the package and, unless [keepDownloads], delete its files. Nothing follows. */
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

/** The user can stop this phase: the reducer is the one place that says so. */
val Phase.cancellable: Boolean get() = TargetRecord(phase = this).on(Event.Cancel).phase != this

/** Whether the runner has work to resume in this phase after a restart. */
val Phase.inFlight: Boolean get() = this !is Phase.Idle && this !is Phase.Failed
