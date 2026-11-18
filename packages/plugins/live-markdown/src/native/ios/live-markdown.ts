import { feedComposerImages } from '@unbound-plugins/shared/composer/native-images';
import type { NativeBridge } from '@unbound-app/api/native';
import { flux } from '@unbound-app/api';

import {
	installComposerEmoji,
	restoreComposerEmoji,
	setComposerEmoji,
	takeEmojiImages,
} from '~/native/ios/custom-emoji';
import { installComposerMarkdown, restoreComposerMarkdown } from '~/native/ios/composer';
import { channelEmoji } from '~/lib/channel-emoji';

const IMAGE_FOLDER = 'Unbound/Temp/unbound.live-markdown/emoji';
const EMOJI_REFRESH_MS = 300;

type ChangeStore = {
	addChangeListener?(listener: () => void): void;
	removeChangeListener?(listener: () => void): void;
};

function currentGuild(): string | undefined {
	const channelId = flux.getStore('SelectedChannel')?.getChannelId?.();
	const channel = channelId ? flux.getStore('Channel').getChannel(channelId) : undefined;

	return channel?.guild_id ?? undefined;
}

function followEmojiStore(onChange: () => void): () => void {
	const store = flux.getStore('Emoji') as unknown as ChangeStore;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const schedule = () => {
		clearTimeout(timer);
		timer = setTimeout(onChange, EMOJI_REFRESH_MS);
	};

	if (!store.addChangeListener) return () => {};

	store.addChangeListener(schedule);

	return () => {
		clearTimeout(timer);
		store.removeChangeListener?.(schedule);
	};
}

/**
 * @description Draws markdown and custom emoji in the composer on iOS until disposed.
 * @param native The plugin's native bridge.
 * @returns `dispose`, which puts the composer text back to plain styling and removes the hooks.
 */
export function liveMarkdownIOS(native: NativeBridge) {
	const scope = native.ui.createScope();
	let pushed = '';
	const pushEmoji = () => {
		const guildId = currentGuild();
		const known = channelEmoji(guildId);
		const signature = `${guildId ?? ''}:${Object.keys(known).length}`;

		if (signature === pushed) return;

		pushed = signature;
		native.ui.run(setComposerEmoji, known);
	};

	native.ui.run(installComposerMarkdown, scope);
	native.ui.run(installComposerEmoji, scope);
	pushEmoji();

	const stopFeeding = feedComposerImages(
		(files) => native.ui.call(takeEmojiImages, files),
		IMAGE_FOLDER,
	);
	const stopFollowing = flux.onAction('CHANNEL_SELECT', () => setTimeout(pushEmoji, 0));
	const stopWatchingEmoji = followEmojiStore(pushEmoji);

	return {
		dispose() {
			stopFollowing();
			stopWatchingEmoji();
			stopFeeding();
			native.ui.run(restoreComposerMarkdown);
			void native.ui
				.call(restoreComposerEmoji)
				.catch((error: unknown) =>
					logger.error('Failed to remove the composer emoji:', error),
				)
				.finally(() => scope.dispose());
		},
	};
}
