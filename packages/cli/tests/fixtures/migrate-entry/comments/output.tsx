// The plugin's entry.
import Panel from '~/panel';

/** Starts the plugin. */
export function start() {}

/**
 * Tears everything down.
 */
export function stop() {
	// nothing left: the scope cleans up
}

// Runs once per enable.
export { Panel as SettingsPanel };

// the custom panel
// trailing note
