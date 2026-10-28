package app.unbound.manager

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import app.unbound.manager.ui.App
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val manager = Manager.get(this)

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) {
                manager.confirmations.pending.collect { pending ->
                    for (target in pending.keys) manager.confirmations.take(target)?.let(::startActivity)
                }
            }
        }
        setContent { App(manager) }
    }

    override fun onResume() {
        super.onResume()
        Manager.get(this).refresh()
    }
}
