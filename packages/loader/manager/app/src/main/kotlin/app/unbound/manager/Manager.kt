package app.unbound.manager

import android.content.Context
import android.content.Intent
import app.unbound.manager.core.Announcement
import app.unbound.manager.core.CheckAction
import app.unbound.manager.core.CheckOutcome
import app.unbound.manager.core.Checked
import app.unbound.manager.core.Event
import app.unbound.manager.core.InstalledPackageState
import app.unbound.manager.core.LastCheck
import app.unbound.manager.core.Phase
import app.unbound.manager.core.Release
import app.unbound.manager.core.Settings
import app.unbound.manager.core.Target
import app.unbound.manager.core.TargetRecord
import app.unbound.manager.core.UpdateDecision
import app.unbound.manager.core.announcement
import app.unbound.manager.core.decide
import app.unbound.manager.core.inFlight
import app.unbound.manager.core.planCheck
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

data class TargetView(
    val target: Target,
    val installed: InstalledPackageState,
    val decision: UpdateDecision,
    val record: TargetRecord,
    val latest: Release?,
    val progress: Progress?,
) {
    val phase: Phase get() = record.phase

    val installable: Release?
        get() = if (decision is UpdateDecision.Blocked) null else latest ?: (phase as? Phase.Failed)?.release
}

class Manager private constructor(private val context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val store = Store(context.filesDir, ::announce)
    private val trusted = trustedSigners(context)
    private val packageReads = MutableStateFlow(0)
    private val mutableChecking = MutableStateFlow(false)

    val confirmations = Confirmations(context)
    private val runner = Runner(context, store, confirmations, trusted)

    val settings: StateFlow<Settings> = store.state.map { it.settings }.stateIn(scope, SharingStarted.Eagerly, store.state.value.settings)

    val checking: StateFlow<Boolean> = mutableChecking

    val lastCheck: StateFlow<LastCheck?> = store.state.map {
        it.lastCheck
    }.stateIn(scope, SharingStarted.Eagerly, store.state.value.lastCheck)

    val views: StateFlow<List<TargetView>> = combine(store.state, packageReads, runner.progress) { state, _, progress ->
        views(state, progress)
    }.stateIn(scope, SharingStarted.Eagerly, emptyList())

    val logRevision: StateFlow<Int> = store.logRevision

    @Volatile var onScreen: Target? = null

    init {
        resume()
        CheckWorker.schedule(context)
        refresh()
    }

    fun resume() {
        scope.launch {
            for (target in Target.entries) {
                if (store.state.value.record(target).phase.inFlight) InstallWorker.enqueue(context, target, replace = false)
            }
        }
    }

    fun refresh() {
        packageReads.value++
        scope.launch { fetch() }
    }

    suspend fun check() {
        fetch()
        val state = store.state.value
        val checked = views(state, emptyMap()).map { Checked(it.target, it.installed, it.decision, it.record) }

        for (action in planCheck(checked, state.settings.autoUpdate, context.packageName)) {
            // Not action::class.simpleName: R8 renames the class in release builds.
            val verb = if (action is CheckAction.Install) "installing" else "notifying"
            store.log(action.target, "Check found ${action.update.latest.tag}: $verb")
            store.markNotified(action.target, action.update.latest.asset.sha256)
            when (action) {
                is CheckAction.Install -> start(action.target, action.update.latest)
                is CheckAction.Notify -> Notifier.available(context, action.target, action.update)
            }
        }
    }

    fun install(target: Target) {
        scope.launch { installNow(target) }
    }

    internal suspend fun installNow(target: Target) {
        val release = view(target, store.state.value, null).installable ?: return
        start(target, release)
    }

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

    private fun announce(target: Target, before: Phase, after: Phase) {
        when (val announcement = announcement(before, after)) {
            is Announcement.Landed -> Notifier.landed(context, target, announcement)
            is Announcement.Failed -> if (onScreen != target) Notifier.failed(context, target, announcement)
            null -> Unit
        }
    }

    private suspend fun start(target: Target, release: Release) {
        Notifier.clearNews(context, target)
        store.apply(target, Event.Start(release))
        InstallWorker.enqueue(context, target, replace = false)
    }

    private suspend fun fetch() {
        mutableChecking.value = true
        try {
            val result = fetchReleases(BuildConfig.RELEASES_URL, store.state.value.feed)

            if (result is FetchResult.Fresh) store.updateFeed(result.cache)

            val outcome = when (result) {
                is FetchResult.Fresh, FetchResult.NotModified ->
                    CheckOutcome.Checked(views(store.state.value, emptyMap()).count { it.decision is UpdateDecision.Available })

                is FetchResult.RateLimited -> CheckOutcome.RateLimited

                is FetchResult.Failed -> CheckOutcome.Failed(result.message)
            }
            store.recordCheck(LastCheck(System.currentTimeMillis(), outcome))
        } finally {
            mutableChecking.value = false
        }
    }

    private fun views(state: Persisted, progress: Map<Target, Progress>): List<TargetView> =
        state.settings.mode.targets.map { view(it, state, progress[it]) }

    private fun view(target: Target, state: Persisted, progress: Progress?): TargetView {
        val installed = context.packageManager.installedState(target.packageName)
        val record = state.record(target)
        val releases = state.feed?.feed?.releasesFor(target, state.settings.channel).orEmpty()

        return TargetView(
            target,
            installed,
            decide(target, installed, record.installedFrom, releases, trusted.getValue(target)),
            record,
            releases.firstOrNull(),
            progress,
        )
    }

    companion object {
        private fun trustedSigners(context: Context): Map<Target, Set<String>> {
            val pinned = BuildConfig.TRUSTED_SIGNER_SHA256.split(",").toSet()
            val own = (context.packageManager.installedState(context.packageName) as InstalledPackageState.Present).signers
            return Target.entries.associateWith { if (it == Target.MANAGER) own else pinned }
        }

        @Volatile private var instance: Manager? = null

        fun get(context: Context): Manager = instance ?: synchronized(this) {
            instance ?: Manager(context.applicationContext).also { instance = it }
        }
    }
}
