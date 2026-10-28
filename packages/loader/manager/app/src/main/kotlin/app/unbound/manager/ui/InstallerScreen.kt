package app.unbound.manager.ui

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.unbound.manager.Manager
import app.unbound.manager.TargetView
import app.unbound.manager.core.InstalledPackageState
import app.unbound.manager.core.Phase
import app.unbound.manager.core.Release
import app.unbound.manager.core.Step
import app.unbound.manager.core.StepState
import app.unbound.manager.core.StepStatus
import app.unbound.manager.core.Target
import app.unbound.manager.core.UpdateDecision
import app.unbound.manager.core.cancellable
import app.unbound.manager.core.inFlight
import app.unbound.manager.core.plainText
import app.unbound.manager.core.steps
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InstallerScreen(manager: Manager, view: TargetView, onBack: () -> Unit) {
    val context = LocalContext.current
    val revision by manager.logRevision.collectAsState()
    val log = remember(revision) { manager.logFile(view.target).takeIf { it.exists() }?.readText().orEmpty() }
    val phase = view.phase
    val done = phase is Phase.Idle && view.decision is UpdateDecision.UpToDate

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(view.target.title) },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } },
            )
        },
    ) { padding ->
        Column(
            Modifier.padding(padding).padding(horizontal = 16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val steps = if (done) Step.entries.map { StepStatus(it, StepState.DONE) } else phase.steps()
            for (status in steps) {
                StepRow(status)
                if (status.step == Step.DOWNLOAD && status.state == StepState.RUNNING) {
                    view.progress?.let { progress ->
                        LinearProgressIndicator(progress = { progress.done.toFloat() / progress.total }, Modifier.fillMaxWidth())
                        Text("${progress.done / MEGABYTE} of ${progress.total / MEGABYTE} MB", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            when {
                phase is Phase.Failed -> Text(phase.failure.describe(), color = MaterialTheme.colorScheme.error)
                phase is Phase.AwaitingUser -> Text("Confirm the install in Android's dialog, or tap the notification.")
                done -> Text("Installed ${view.installed.versionLabel()}.")
            }
            if (done && view.target == Target.MODULE) ModuleHint()

            val update = view.decision as? UpdateDecision.Available
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (phase is Phase.Failed) Button(onClick = { manager.install(view.target) }) { Text("Retry") }
                if (phase == Phase.Idle && update != null) {
                    Button(onClick = { manager.install(view.target) }) { Text("Update to ${update.latest.version}") }
                }
                if (phase.cancellable) {
                    OutlinedButton(onClick = { manager.cancel(view.target) }) { Text(if (phase.inFlight) "Cancel" else "Dismiss") }
                }
                OutlinedButton(onClick = {
                    val share = Intent(Intent.ACTION_SEND)
                        .setType("text/plain")
                        .putExtra(Intent.EXTRA_SUBJECT, "Unbound Manager log: ${view.target.title}")
                        .putExtra(Intent.EXTRA_TEXT, log)
                    context.startActivity(Intent.createChooser(share, "Share log"))
                }) { Text("Share log") }
            }

            if (update != null) Changelog(update.skipped)

            Text("Log", style = MaterialTheme.typography.titleSmall)
            Text(
                log.lines().takeLast(LOG_LINES).joinToString("\n"),
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                lineHeight = 14.sp,
                modifier = Modifier.padding(bottom = 24.dp),
            )
        }
    }
}

@Composable
private fun Changelog(releases: List<Release>) {
    Text("What's new", style = MaterialTheme.typography.titleSmall)
    for (release in releases) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(release.tag, style = MaterialTheme.typography.titleSmall)
            Text(DATE.format(Instant.ofEpochMilli(release.publishedAt)), style = MaterialTheme.typography.bodySmall)
            Text(plainText(release.notes).ifEmpty { "No release notes." }, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun StepRow(status: StepStatus) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        when (status.state) {
            StepState.RUNNING -> CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            StepState.DONE -> Glyph("✓", MaterialTheme.colorScheme.primary)
            StepState.FAILED -> Glyph("✕", MaterialTheme.colorScheme.error)
            StepState.PENDING -> Glyph("○", MaterialTheme.colorScheme.outline)
        }
        Text(status.step.title, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun Glyph(text: String, color: Color) {
    Text(text, color = color, modifier = Modifier.width(20.dp), style = MaterialTheme.typography.titleMedium)
}

private fun InstalledPackageState.versionLabel(): String = when (this) {
    is InstalledPackageState.Present -> "$versionName ($versionCode)"
    InstalledPackageState.Missing -> "nothing"
}

private val DATE = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withZone(ZoneId.systemDefault())

private const val MEGABYTE = 1_000_000
private const val LOG_LINES = 80
