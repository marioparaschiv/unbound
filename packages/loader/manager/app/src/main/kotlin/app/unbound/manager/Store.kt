package app.unbound.manager

import android.util.AtomicFile
import app.unbound.manager.core.Event
import app.unbound.manager.core.InstalledPackageState
import app.unbound.manager.core.LastCheck
import app.unbound.manager.core.Phase
import app.unbound.manager.core.Settings
import app.unbound.manager.core.Target
import app.unbound.manager.core.TargetRecord
import app.unbound.manager.core.on
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.io.File
import java.time.Instant

@Serializable
data class Persisted(
    val settings: Settings = Settings(),
    val records: Map<Target, TargetRecord> = emptyMap(),
    val feed: FeedCache? = null,
    val lastCheck: LastCheck? = null,
) {
    fun record(target: Target): TargetRecord = records[target] ?: TargetRecord()
}

class Store(private val dir: File, private val onChange: (Target, Phase, Phase) -> Unit) {
    private val file = AtomicFile(File(dir, "state.json"))
    private val mutex = Mutex()
    private val mutableState = MutableStateFlow(load())
    private val mutableLogRevision = MutableStateFlow(0)

    val state: StateFlow<Persisted> = mutableState

    val logRevision: StateFlow<Int> = mutableLogRevision

    suspend fun apply(target: Target, event: Event): TargetRecord = mutex.withLock {
        val before = mutableState.value.record(target)
        val after = before.on(event)

        if (after == before) {
            log(target, "Ignored ${event.label()} in ${before.phase.label()}")
            return before
        }

        write(mutableState.value.let { it.copy(records = it.records + (target to after)) })
        log(target, "${before.phase.label()} + ${event.label()} -> ${after.phase.label()}")
        if (after.phase != before.phase) onChange(target, before.phase, after.phase)
        after
    }

    suspend fun updateSettings(transform: (Settings) -> Settings): Unit = mutex.withLock {
        write(mutableState.value.let { it.copy(settings = transform(it.settings)) })
    }

    suspend fun updateFeed(feed: FeedCache): Unit = mutex.withLock {
        write(mutableState.value.copy(feed = feed))
    }

    suspend fun recordCheck(check: LastCheck): Unit = mutex.withLock {
        write(mutableState.value.copy(lastCheck = check))
    }

    suspend fun markNotified(target: Target, sha256: String): Unit = mutex.withLock {
        val state = mutableState.value
        write(state.copy(records = state.records + (target to state.record(target).copy(notifiedSha256 = sha256))))
    }

    fun logFile(target: Target): File = File(dir, "logs/${target.name.lowercase()}.log")

    fun log(target: Target, message: String) {
        synchronized(this) {
            val log = logFile(target)
            log.parentFile?.mkdirs()
            log.appendText("${Instant.now()} $message\n")
        }
        mutableLogRevision.value++
    }

    private fun write(next: Persisted) {
        val stream = file.startWrite()

        try {
            stream.write(JSON.encodeToString(Persisted.serializer(), next).toByteArray())
            file.finishWrite(stream)
        } catch (error: Exception) {
            file.failWrite(stream)
            throw error
        }
        mutableState.value = next
    }

    private fun load(): Persisted = try {
        JSON.decodeFromString(Persisted.serializer(), file.readFully().decodeToString())
    } catch (_: java.io.FileNotFoundException) {
        Persisted()
    } catch (_: SerializationException) {
        Persisted()
    } catch (_: IllegalArgumentException) {
        Persisted()
    }
}

private val JSON = Json { ignoreUnknownKeys = true }

private fun Phase.label(): String = when (this) {
    is Phase.Downloading -> "Downloading(${release.tag})"
    is Phase.Verifying -> "Verifying(${release.tag})"
    is Phase.Committing -> "Committing(${artifact.versionCode})"
    is Phase.Committed -> "Committed(session $sessionId)"
    is Phase.AwaitingUser -> "AwaitingUser(session $sessionId)"
    is Phase.Confirming -> "Confirming(${artifact.versionCode})"
    is Phase.Failed -> "Failed($step: $failure)"
    Phase.Idle -> "Idle"
}

private fun Event.label(): String = when (this) {
    is Event.Start -> "Start(${release.tag}, sha256 ${release.asset.sha256})"

    is Event.Verified -> "Verified(versionCode $versionCode, ${splits.size} splits)"

    is Event.Observed -> when (val installed = installed) {
        is InstalledPackageState.Present ->
            "Observed(versionCode ${installed.versionCode}, installer ${installed.installer}, updated ${installed.lastUpdateTime})"

        InstalledPackageState.Missing -> "Observed(missing)"
    }

    else -> toString()
}
