import { createLogger } from '@unbound-app/logger';

import { disable, getAll, isEnabled } from '~/plugins/api';
import { pluginSourceName } from '~/plugins/source-name';
import { show } from '~/toasts/api';

import { FLOOD_LIMIT } from './rejection-floods';

const Logger = createLogger('Core', 'RejectionFloods');

/**
 * @description Turns off the plugin a flood of unhandled rejections came from, and tells the user.
 * @param addon The plugin's source name, as its stack frames show it.
 */
export function disableFloodingPlugin(addon: string): void {
	const source = `unbound-plugin/${addon}.js`;
	const plugin = getAll().find(
		({ id }) => pluginSourceName(id) === source || id.endsWith(`.${addon}`),
	);

	if (!plugin || !isEnabled(plugin.id)) return;

	try {
		disable(plugin.id);
		Logger.warn(
			`Disabled ${plugin.id}: it left ${FLOOD_LIMIT} promise rejections unhandled within a minute.`,
		);
		show({
			title: plugin.name,
			content: `Disabled ${plugin.name} because it kept failing in the background.`,
		});
	} catch (error) {
		Logger.error(`Failed to disable flooding plugin ${plugin.id}:`, error);
	}
}

export default disableFloodingPlugin;
