package app.unbound.manager

import android.content.Context
import app.unbound.manager.core.Effect
import app.unbound.manager.core.Event
import app.unbound.manager.core.Failure
import app.unbound.manager.core.Target
import app.unbound.manager.core.effect
import app.unbound.manager.effects.Sessions
import app.unbound.manager.effects.download
import app.unbound.manager.effects.splitsDir
import app.unbound.manager.effects.verify
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import java.io.File

/** Bytes on disk of the running download. In memory only: the phase is what survives a restart. */
data class Progress(val done: Long, val total: Long)

/**
 * The loop `phase -> effect -> event -> store.apply`. One runs per target at a time (unique work), and
 * a resume after process death is the same loop from the persisted phase.
 */
class Runner(
    private val context: Context,
    private val store: Store,
    private val confirmations: Confirmations,
    private val trusted: Map<Target, Set<String>>,
) {
    private val sessions = Sessions(context)
    private val mutableProgress = MutableStateFlow<Map<Target, Progress>>(emptyMap())

    val progress: StateFlow<Map<Target, Progress>> = mutableProgress

    /** Returns when the phase is at rest or waits on Android or the user. [foreground] is called before a download. */
    suspend fun drive(target: Target, foreground: suspend () -> Unit) {
        while (true) {
            val record = store.state.value.record(target)
            val effect = record.phase.effect()
            val event = try {
                perform(target, effect, foreground)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                store.log(target, "$effect threw ${error.stackTraceToString()}")
                Event.Fail(Failure.Unexpected(error.message ?: error.javaClass.simpleName))
            } ?: return

            if (store.apply(target, event) == record) return
        }
    }

    private suspend fun perform(target: Target, effect: Effect, foreground: suspend () -> Unit): Event? {
        val dir = downloads(target)
        val log = { message: String -> store.log(target, message) }

        return when (effect) {
            is Effect.Download -> {
                foreground()
                try {
                    download(effect.release.asset, dir, { done, total -> report(target, done, total) }, log)
                } finally {
                    mutableProgress.update { it - target }
                    Notifier.clearProgress(context, target)
                }
            }

            is Effect.Verify -> verify(
                context.packageManager,
                target,
                effect.release,
                dir,
                trusted.getValue(target),
                context.packageManager.installedState(target.packageName),
                log,
            )

            is Effect.OpenSession -> sessions.open(target, effect.artifact, splitsDir(dir, effect.artifact.release), log)

            is Effect.Commit -> sessions.commit(target, effect.sessionId, log)

            is Effect.AwaitUser -> sessions.awaitUser(effect.sessionId, confirmations.isHeld(target))

            Effect.Confirm -> Event.Observed(context.packageManager.installedState(target.packageName))

            is Effect.Cleanup -> {
                sessions.abandonAll(target, log)
                confirmations.release(target)
                if (!effect.keepDownloads) dir.deleteRecursively()
                null
            }
        }
    }

    /** Publishes progress at most once per permille so the UI and notification are not flooded. */
    private fun report(target: Target, done: Long, total: Long) {
        val previous = mutableProgress.value[target]

        if (previous != null && previous.done * PERMILLE / total == done * PERMILLE / total) return

        mutableProgress.update { it + (target to Progress(done, total)) }
        Notifier.showProgress(context, target, done, total)
    }

    private fun downloads(target: Target) = File(context.noBackupFilesDir, "downloads/${target.name.lowercase()}")
}

private const val PERMILLE = 1000
