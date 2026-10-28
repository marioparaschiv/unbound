package app.unbound.manager.ui

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.text.format.DateUtils
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import app.unbound.manager.Manager
import app.unbound.manager.TargetView
import app.unbound.manager.core.Channel
import app.unbound.manager.core.CheckOutcome
import app.unbound.manager.core.LastCheck
import app.unbound.manager.core.Mode
import app.unbound.manager.core.Target

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(manager: Manager, views: List<TargetView>, onOpen: (Target) -> Unit) {
    val context = LocalContext.current
    val settings by manager.settings.collectAsState()
    val checking by manager.checking.collectAsState()
    val lastCheck by manager.lastCheck.collectAsState()
    var askUnknownSources by remember { mutableStateOf(false) }
    val notificationsAllowed = rememberNotificationPermission()

    fun start(target: Target) {
        if (!context.packageManager.canRequestPackageInstalls()) {
            askUnknownSources = true
            return
        }
        manager.install(target)
        onOpen(target)
    }

    Scaffold(topBar = { TopAppBar(title = { Text("Unbound Manager") }) }) { padding ->
        Column(
            Modifier.padding(padding).padding(horizontal = 16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Picker("Install as", Mode.entries, settings.mode, Mode::title) { mode -> manager.updateSettings { it.copy(mode = mode) } }
            Picker("Channel", Channel.entries, settings.channel, Channel::title) { channel ->
                manager.updateSettings { it.copy(channel = channel) }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Update automatically", Modifier.weight(1f), style = MaterialTheme.typography.labelLarge)
                Switch(
                    checked = settings.autoUpdate,
                    onCheckedChange = { on -> manager.updateSettings { it.copy(autoUpdate = on) } },
                )
            }
            Text(
                if (checking) "Checking for updates…" else lastCheck?.let { checkedLabel(context, it) } ?: "Not checked yet",
                style = MaterialTheme.typography.bodySmall,
                color = if (lastCheck?.outcome is CheckOutcome.Checked || checking) Color.Unspecified else MaterialTheme.colorScheme.error,
            )
            if (!notificationsAllowed) {
                Text(
                    "Notifications are off, so updates only show here. Tap to turn them on.",
                    Modifier.clickable {
                        context.startActivity(
                            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName),
                        )
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            for (view in views) {
                TargetCard(
                    view = view,
                    channel = settings.channel,
                    onInstall = { start(view.target) },
                    onOpen = { onOpen(view.target) },
                    onUninstall = {
                        context.startActivity(Intent(Intent.ACTION_DELETE, Uri.parse("package:${view.target.packageName}")))
                    },
                )
            }
        }
    }

    if (askUnknownSources) {
        AlertDialog(
            onDismissRequest = { askUnknownSources = false },
            title = { Text("Allow installing apps") },
            text = {
                Text(
                    "Android asks before an app installs other apps. Turn on \"Allow from this source\" " +
                        "for Unbound Manager, come back, and tap Install again.",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    askUnknownSources = false
                    context.startActivity(
                        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")),
                    )
                }) { Text("Open settings") }
            },
            dismissButton = { TextButton(onClick = { askUnknownSources = false }) { Text("Not now") } },
        )
    }
}

@Composable
private fun rememberNotificationPermission(): Boolean {
    val context = LocalContext.current
    val notifications = context.getSystemService(NotificationManager::class.java)
    var allowed by remember { mutableStateOf(notifications.areNotificationsEnabled()) }
    var asked by rememberSaveable { mutableStateOf(false) }
    val request = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { allowed = it }

    LifecycleResumeEffect(Unit) {
        allowed = notifications.areNotificationsEnabled()
        onPauseOrDispose {}
    }
    LaunchedEffect(Unit) {
        if (asked || allowed || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return@LaunchedEffect
        asked = true
        request.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
    return allowed
}

private fun checkedLabel(context: Context, check: LastCheck): String {
    val time = DateUtils.formatDateTime(context, check.at, DateUtils.FORMAT_SHOW_TIME or DateUtils.FORMAT_SHOW_DATE)
    return "Last checked $time: ${check.outcome.label()}"
}

@Composable
private fun <T> Picker(label: String, options: List<T>, selected: T, title: (T) -> String, onSelect: (T) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.labelLarge)
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            options.forEachIndexed { index, option ->
                SegmentedButton(
                    selected = option == selected,
                    onClick = { onSelect(option) },
                    shape = SegmentedButtonDefaults.itemShape(index, options.size),
                ) { Text(title(option)) }
            }
        }
    }
}
