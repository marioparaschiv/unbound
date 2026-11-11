import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import type { PluginContext } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import {
	enableMentions as enableAndroidMentions,
	ROLE_MENTION_COLORS as androidRoleMentionColors,
} from '~/native/mentions-android';
import {
	enableMentions as enableIosMentions,
	ROLE_MENTION_COLORS as iosRoleMentionColors,
} from '~/native/mentions-ios';

export type Enqueue = (step: () => void | Promise<void>) => void;

const enableNativeMentions = native.definePlatform({
	ios: enableIosMentions,
	android: enableAndroidMentions,
});

/** Whether chat rows color role mentions themselves; iOS does, Android leaves them to Discord. */
export const roleMentionColors = native.definePlatform({
	ios: iosRoleMentionColors,
	android: androidRoleMentionColors,
});

let queue = Promise.resolve();
let stopNativeMentions: (() => void) | undefined;

function enqueue(step: Parameters<Enqueue>[0]) {
	queue = queue.then(step).catch((error) => {
		if (!isCancellation(error)) {
			logger.error(`Failed to update native mentions:`, error);
		}
	});
}

/**
 * @description Colors mentions in native message cells and the chat input on iOS, and in the chat input on Android, while
 * `chatMentions` is on. Each enable is queued after the previous teardown so views are restored before they are painted again.
 * @param context The plugin context, whose Objective-C or Java bridge paints the mentions.
 */
export function colorNativeMentions(context: PluginContext): void {
	stopNativeMentions = whileEnabled('chatMentions', () => {
		if (!ensureCapabilities(context.native, context.capabilities)) {
			return () => {};
		}

		return enableNativeMentions(context.native, enqueue);
	});
}

/**
 * @description Restores the native views {@link colorNativeMentions} painted. The native bridge is not scoped to the plugin,
 * so `stop` awaits this.
 * @returns A promise that settles once every queued native step has.
 */
export function restoreNativeMentions(): Promise<void> {
	stopNativeMentions?.();
	stopNativeMentions = undefined;

	return queue;
}
