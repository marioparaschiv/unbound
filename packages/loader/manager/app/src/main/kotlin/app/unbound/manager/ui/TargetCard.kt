package app.unbound.manager.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.unbound.manager.TargetView
import app.unbound.manager.core.Channel
import app.unbound.manager.core.InstalledPackageState
import app.unbound.manager.core.Phase
import app.unbound.manager.core.Target
import app.unbound.manager.core.UpdateDecision
import app.unbound.manager.core.inFlight

/** Every label is a function of the view; the card holds no state. */
@Composable
fun TargetCard(view: TargetView, channel: Channel, onInstall: () -> Unit, onOpen: () -> Unit, onUninstall: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(view.target.title, style = MaterialTheme.typography.titleMedium)
            Text("Installed: ${view.installed.label()}")
            val stream = if (view.target == Target.MANAGER) "Latest" else "Latest ${channel.label}"
            Text("$stream: ${view.latest?.let { "${it.version} (${it.tag})" } ?: "no release yet"}")
            Text(view.decision.label(view.target), style = MaterialTheme.typography.bodyMedium)

            val decision = view.decision
            when {
                view.phase.inFlight -> Button(onClick = onOpen) { Text("Installing… show progress") }
                decision is UpdateDecision.Blocked -> Blocked(view.target, onUninstall)
                view.target == Target.MANAGER && decision !is UpdateDecision.Available && view.phase !is Phase.Failed -> Unit
                else -> Button(onClick = onInstall, enabled = view.installable != null) { Text(view.primaryLabel()) }
            }
            if (view.phase is Phase.Failed) OutlinedButton(onClick = onOpen) { Text("Show what failed") }
            if (decision is UpdateDecision.Available && !view.phase.inFlight) OutlinedButton(onClick = onOpen) { Text("What's new") }
            if (view.target == Target.MODULE && view.installed is InstalledPackageState.Present) ModuleHint()
        }
    }
}

/** Play Store Discord: the user must uninstall it, and should know what that costs before they do. */
@Composable
private fun Blocked(target: Target, onUninstall: () -> Unit) {
    val app = if (target == Target.DISCORD) "Discord" else target.packageName

    Text(
        "$app on this device comes from somewhere else, such as the Play Store. ${target.title} is signed differently, " +
            "so Android cannot install it over this copy. Uninstall $app first. Uninstalling deletes its local data, " +
            "including your login.",
        color = MaterialTheme.colorScheme.error,
    )
    Button(onClick = onUninstall) { Text("Uninstall $app") }
}

@Composable
fun ModuleHint() {
    Text(
        "Open LSPosed, enable the Unbound module and tick Discord (com.discord) in its scope. Then force-stop Discord " +
            "so it starts with the module.",
        style = MaterialTheme.typography.bodySmall,
    )
}

private fun InstalledPackageState.label(): String = when (this) {
    InstalledPackageState.Missing -> "not installed"
    is InstalledPackageState.Present -> "$versionName ($versionCode)"
}

private fun UpdateDecision.label(target: Target): String = when (this) {
    UpdateDecision.NoRelease -> if (target == Target.MANAGER) "No release published yet." else "Nothing to install on this channel yet."
    is UpdateDecision.NotInstalled -> "Not installed."
    is UpdateDecision.UpToDate -> "Up to date."
    is UpdateDecision.Available -> "Update available: ${skipped.size} newer build${if (skipped.size == 1) "" else "s"}."
    is UpdateDecision.Blocked -> "Installed from another source."
}

private fun TargetView.primaryLabel(): String = when {
    phase is Phase.Failed -> "Retry"
    decision is UpdateDecision.Available -> "Update to ${decision.latest.version}"
    decision is UpdateDecision.UpToDate -> "Reinstall"
    else -> "Install"
}
