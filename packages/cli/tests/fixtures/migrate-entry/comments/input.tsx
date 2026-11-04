// The plugin's entry.
import Panel from '~/panel';

/** Starts the plugin. */
function start() {}

export default {
	// Runs once per enable.
	start,
	/**
	 * Tears everything down.
	 */
	stop() {
		// nothing left: the scope cleans up
	},
	getSettingsPanel: () => <Panel />, // the custom panel
};
// trailing note
