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

function currentGuild(): string | undefined {
	const channelId = flux.getStore('SelectedChannel')?.getChannelId?.();
	const channel = channelId ? flux.getStore('Channel').getChannel(channelId) : undefined;

	return channel?.guild_id ?? undefined;
}

/**
 * @description Draws markdown and custom emoji in the composer on iOS until disposed.
 * @param native The plugin's native bridge.
 * @returns `dispose`, which puts the composer text back to plain styling and removes the hooks.
 */
export function liveMarkdownIOS(native: NativeBridge) {
	const scope = native.ui.createScope();
	const pushEmoji = () => native.ui.run(setComposerEmoji, channelEmoji(currentGuild()));

	native.ui.run(installComposerMarkdown, scope);
	native.ui.run(installComposerEmoji, scope);
	pushEmoji();

	const stopFeeding = feedComposerImages(
		(files) => native.ui.call(takeEmojiImages, files),
		IMAGE_FOLDER,
	);
	const stopFollowing = flux.onAction('CHANNEL_SELECT', () => setTimeout(pushEmoji, 0));

	return {
		dispose() {
			stopFollowing();
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
