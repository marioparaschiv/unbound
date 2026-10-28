package app.unbound.manager

import android.content.Context
import android.content.Intent
import app.unbound.manager.core.Event
import app.unbound.manager.core.InstalledPackageState
import app.unbound.manager.core.Phase
import app.unbound.manager.core.Release
import app.unbound.manager.core.Settings
import app.unbound.manager.core.Target
import app.unbound.manager.core.TargetRecord
import app.unbound.manager.core.UpdateDecision
import app.unbound.manager.core.decide
import app.unbound.manager.core.inFlight
import app.unbound.manager.core.releasesFor
import app.unbound.manager.core.sessionEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Everything a screen shows for one target. Derived on every change, never stored. */
data class TargetView(
    val target: Target,
    val installed: InstalledPackageState,
    val decision: UpdateDecision,
    val record: TargetRecord,
    /** Newest release of this target on the channel. */
    val latest: Release?,
    val progress: Progress?,
) {
    val phase: Phase get() = record.phase

    /** What Install, Update, Reinstall or Retry would start: the newest release, or the failed one if the channel has none. */
    val installable: Release?
        get() = if (decision is UpdateDecision.Blocked) null else latest ?: (phase as? Phase.Failed)?.release
}

sealed interface FeedStatus {
    data object Idle : FeedStatus

    data object Loading : FeedStatus

    data class Failed(val message: String) : FeedStatus
}

/** The one entry point for screens, the worker and the receiver. */
class Manager private constructor(private val context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val store = Store(context.filesDir)
    private val trusted = BuildConfig.TRUSTED_SIGNER_SHA256.split(",").toSet()
    private val refreshes = MutableStateFlow(0)
    private val mutableFeedStatus = MutableStateFlow<FeedStatus>(FeedStatus.Idle)

    val confirmations = Confirmations(context)
    private val runner = Runner(context, store, confirmations, trusted)

    val settings: StateFlow<Settings> = store.state.map { it.settings }.stateIn(scope, SharingStarted.Eagerly, store.state.value.settings)

    val feedStatus: StateFlow<FeedStatus> = mutableFeedStatus

    /** The targets the current mode tracks. The manager's own card arrives with self-update. */
    val views: StateFlow<List<TargetView>> = combine(store.state, refreshes, runner.progress) { state, _, progress ->
        state.settings.mode.targets.filter { it != Target.MANAGER }.map { view(it, state, progress[it]) }
    }.stateIn(scope, SharingStarted.Eagerly, emptyList())

    val logRevision: StateFlow<Int> = store.logRevision

    init {
        scope.launch {
            for (target in Target.entries) {
                if (store.state.value.record(target).phase.inFlight) InstallWorker.enqueue(context, target, replace = false)
            }
        }
        refresh()
    }

    /** Rereads installed packages and refetches the release list (a 304 when unchanged). */
    fun refresh() {
        refreshes.value++
        scope.launch {
            mutableFeedStatus.value = FeedStatus.Loading
            mutableFeedStatus.value = when (val result = fetchReleases(BuildConfig.RELEASES_URL, store.state.value.feed)) {
                is FetchResult.Fresh -> FeedStatus.Idle.also { store.updateFeed(result.cache) }
                FetchResult.NotModified -> FeedStatus.Idle
                is FetchResult.RateLimited -> FeedStatus.Failed("GitHub rate limit reached, try again later")
                is FetchResult.Failed -> FeedStatus.Failed(result.message)
            }
        }
    }

    /** Idempotent: a second tap while an install runs changes nothing. */
    fun install(target: Target) {
        scope.launch {
            val release = view(target, store.state.value, null).installable ?: return@launch
            store.apply(target, Event.Start(release))
            InstallWorker.enqueue(context, target, replace = false)
        }
    }

    /** Stops the install if its phase allows, then reruns the runner so cleanup abandons the session and files. */
    fun cancel(target: Target) {
        scope.launch {
            store.apply(target, Event.Cancel)
            InstallWorker.enqueue(context, target, replace = true)
        }
    }

    fun updateSettings(transform: (Settings) -> Settings) {
        scope.launch { store.updateSettings(transform) }
    }

    fun logFile(target: Target) = store.logFile(target)

    internal suspend fun drive(target: Target, foreground: suspend () -> Unit) = runner.drive(target, foreground)

    internal suspend fun onSessionResult(target: Target, sessionId: Int, status: Int, message: String?, confirm: Intent?) {
        store.log(target, "Session $sessionId reported status $status${message?.let { ": $it" }.orEmpty()}")
        val event = sessionEvent(sessionId, status, message)
        val phase = store.apply(target, event).phase

        if (event is Event.NeedsUser && phase is Phase.AwaitingUser && phase.sessionId == sessionId && confirm != null) {
            confirmations.hold(target, confirm)
        } else if (phase !is Phase.AwaitingUser) {
            confirmations.release(target)
        }
        InstallWorker.enqueue(context, target, replace = false)
    }

    internal fun log(target: Target, message: String) = store.log(target, message)

    private fun view(target: Target, state: Persisted, progress: Progress?): TargetView {
        val installed = context.packageManager.installedState(target.packageName)
        val record = state.record(target)
        val releases = state.feed?.feed?.releasesFor(target, state.settings.channel).orEmpty()

        return TargetView(
            target,
            installed,
            decide(target, installed, record.installedFrom, releases, trusted),
            record,
            releases.firstOrNull(),
            progress,
        )
    }

    companion object {
        @Volatile private var instance: Manager? = null

        fun get(context: Context): Manager = instance ?: synchronized(this) {
            instance ?: Manager(context.applicationContext).also { instance = it }
        }
    }
}
