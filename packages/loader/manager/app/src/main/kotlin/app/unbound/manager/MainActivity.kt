package app.unbound.manager

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import app.unbound.manager.core.Target
import app.unbound.manager.ui.App
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    /** The target whose screen is open, or null for Home. A notification tap sets it through [EXTRA_TARGET]. */
    private var open by mutableStateOf<Target?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val manager = Manager.get(this)

        open = (savedInstanceState?.getString(EXTRA_TARGET) ?: intent.getStringExtra(EXTRA_TARGET))?.let(::targetNamed)
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) {
                manager.confirmations.pending.collect { pending ->
                    for (target in pending.keys) manager.confirmations.take(target)?.let(::startActivity)
                }
            }
        }
        setContent { App(manager, open, onOpen = { open = it }) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra(EXTRA_TARGET)?.let(::targetNamed)?.let { open = it }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(EXTRA_TARGET, open?.name)
    }

    override fun onResume() {
        super.onResume()
        Manager.get(this).refresh()
    }

    companion object {
        const val EXTRA_TARGET = "target"
    }
}

private fun targetNamed(name: String): Target? = Target.entries.find { it.name == name }
