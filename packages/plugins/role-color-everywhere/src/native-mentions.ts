import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';

import { enableNativeMentions } from '~/platform';
import { PLUGIN_NAME } from '~/constants';

export type Enqueue = (step: () => void | Promise<void>) => void;

export type NativeMentions = {
	enable: () => () => void;
	settled: () => Promise<void>;
};

/**
 * @description Colors mentions in native message cells and the chat input on iOS, and in the chat input on Android, queueing each enable after the previous teardown so views are restored before they are painted again.
 * @param context The plugin context, whose Objective-C or Java bridge paints the mentions.
 * @returns `enable`, which applies both features and returns their removal, and `settled`, which resolves once queued work finishes.
 */
export function createNativeMentions(context: PluginContext): NativeMentions {
	let queue = Promise.resolve();

	function enqueue(step: Parameters<Enqueue>[0]) {
		queue = queue.then(step).catch((error) => {
			if (!isCancellation(error)) {
				console.error(`[${PLUGIN_NAME}] Failed to update native mentions:`, error);
			}
		});
	}

	function enable(): () => void {
		if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) {
			return () => {};
		}

		return enableNativeMentions(context.native, enqueue);
	}

	return { enable, settled: () => queue };
}

export default createNativeMentions;
