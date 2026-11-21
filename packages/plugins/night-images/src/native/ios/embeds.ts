import type { NativeBridge } from '@unbound-app/api/native';
import { flux, plugins, storage } from '@unbound-app/api';

import { dimmedOpacity, isActive, isBrightPlaceholder } from '~/lib/dimming';
import { brightEmbedMessages, type MessageLike } from '~/lib/embed-images';
import {
	installEmbedDimming,
	restoreEmbedDimming,
	setEmbedDimming,
	type EmbedDimming,
} from '~/native/ios/ui-embeds';

type MessageStore = { getMessages(channelId: string): { _array?: MessageLike[] } | undefined };
type SelectedChannelStore = { getChannelId(): string | undefined };

const PUSH_DELAY_MS = 100;
const SCHEDULE_CHECK_MS = 60_000;

const Messages = flux.getStore('Message') as unknown as MessageStore;
const SelectedChannel = flux.getStore('SelectedChannel') as unknown as SelectedChannelStore;

function currentDimming(): EmbedDimming {
	const channelId = SelectedChannel.getChannelId();
	const loaded = channelId ? (Messages.getMessages(channelId)?._array ?? []) : [];

	return {
		messageIds: isActive() ? brightEmbedMessages(loaded, isBrightPlaceholder) : [],
		opacity: dimmedOpacity(),
	};
}

/**
 * @description Dims bright images in message embeds on iOS, which chat rows give no opacity for, from a UI-thread hook on
 * message cells fed the messages to dim.
 * @param native The plugin's native bridge.
 * @returns A function that removes the hook and restores every dimmed embed.
 */
export function dimIosEmbeds(native: NativeBridge): () => Promise<void> {
	const scope = native.ui.createScope();
	let pushed = currentDimming();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let restyling = false;

	function push() {
		const redraw = restyling;

		timer = undefined;
		restyling = false;
		const next = currentDimming();

		if (JSON.stringify(next) === JSON.stringify(pushed)) return;

		pushed = next;
		native.ui.run(setEmbedDimming, next);

		if (redraw) plugins.redrawChat();
	}

	function schedulePush() {
		timer ??= setTimeout(push, PUSH_DELAY_MS);
	}

	function scheduleRestyle() {
		restyling = true;
		schedulePush();
	}

	native.ui.run(installEmbedDimming, scope, pushed);

	const stopMessages = flux.onStoreChange(flux.getStore('Message'), schedulePush);
	const stopChannel = flux.onStoreChange(flux.getStore('SelectedChannel'), schedulePush);
	const stopTheme = flux.onStoreChange(flux.getStore('Theme'), scheduleRestyle);
	const stopSettings = storage.onChange(({ store }) => store === addon.id, scheduleRestyle);
	const schedule = setInterval(scheduleRestyle, SCHEDULE_CHECK_MS);

	return async () => {
		clearTimeout(timer);
		clearInterval(schedule);
		stopMessages();
		stopChannel();
		stopTheme();
		stopSettings();

		if (typeof native.ui.call === 'function') {
			await native.ui
				.call(restoreEmbedDimming)
				.catch((error) => logger.warn('Failed to restore the dimmed embed images:', error));
		} else {
			native.ui.run(restoreEmbedDimming);
		}

		scope.dispose();
	};
}
