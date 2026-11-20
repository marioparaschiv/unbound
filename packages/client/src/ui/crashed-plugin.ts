import toError from '@unbound-app/utils/to-error';

import { stackAddon } from '~/diagnostics/recent-errors';
import { pluginSourceName } from '~/plugins/source-name';
import { getAll } from '~/plugins/api';

/**
 * @description Names the plugin whose bundle a caught render error's stack runs through, for the crash screen.
 * @param error The caught error.
 * @param componentStack React's component stack for it, if any.
 * @returns The plugin's name, or `undefined` when no plugin frame is on the stacks.
 */
// UNKNOWN: anything can be thrown during a render.
export function crashedPluginName(error: unknown, componentStack = ''): string | undefined {
	const addon = stackAddon(`${toError(error).stack ?? ''}\n${componentStack}`);

	if (!addon) {
		return undefined;
	}

	const source = `unbound-plugin/${addon}.js`;

	return getAll().find(({ id }) => pluginSourceName(id) === source || id.endsWith(`.${addon}`))
		?.name;
}

export default crashedPluginName;
