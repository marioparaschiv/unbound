package app.unbound.manager

import android.content.Context
import android.content.Intent
import app.unbound.manager.core.Target
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import java.util.concurrent.ConcurrentHashMap

/**
 * The confirm Intents of STATUS_PENDING_USER_ACTION. Android blocks starting them from a receiver, so each
 * is posted as a notification and offered to a resumed activity. An Intent cannot be persisted: after
 * process death only the notification proves it still exists.
 */
class Confirmations(private val context: Context) {
    private val held: MutableSet<Target> = ConcurrentHashMap.newKeySet()
    private val mutablePending = MutableStateFlow<Map<Target, Intent>>(emptyMap())

    /** Intents no activity has launched yet. */
    val pending: StateFlow<Map<Target, Intent>> = mutablePending

    fun hold(target: Target, intent: Intent) {
        held += target
        Notifier.confirm(context, target, intent)
        mutablePending.update { it + (target to intent) }
    }

    /** For a resumed activity to launch. The notification stays until the session ends. */
    fun take(target: Target): Intent? {
        var taken: Intent? = null
        mutablePending.update {
            taken = it[target]
            it - target
        }
        return taken
    }

    fun isHeld(target: Target): Boolean = target in held || Notifier.hasConfirm(context, target)

    fun release(target: Target) {
        held -= target
        mutablePending.update { it - target }
        Notifier.clearConfirm(context, target)
    }
}
