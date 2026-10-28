package app.unbound.manager.ui

import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import app.unbound.manager.Manager
import app.unbound.manager.core.Target

/** Two screens: home, and the installer for one target. */
@Composable
fun App(manager: Manager, open: Target?, onOpen: (Target?) -> Unit) {
    val context = LocalContext.current
    val dark = isSystemInDarkTheme()
    val colors = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> darkColorScheme()
        else -> lightColorScheme()
    }

    MaterialTheme(colorScheme = colors) {
        val views by manager.views.collectAsState()
        val view = views.find { it.target == open }

        if (view == null) {
            HomeScreen(manager, views, onOpen = onOpen)
            return@MaterialTheme
        }

        BackHandler { onOpen(null) }
        InstallerScreen(manager, view, onBack = { onOpen(null) })
    }
}
