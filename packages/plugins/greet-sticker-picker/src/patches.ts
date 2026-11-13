import { metro, patcher } from '@unbound-app/api';

import { openGreetSheet } from '~/components/greet-sheet';
import { greetStickers, type GreetSticker } from '~/lib/stickers';

type WelcomeArgs = [channel: unknown, message: unknown, stickerId: string];

/**
 * @description Lets you pick which sticker 'Wave to say hi!' sends instead of Discord's random one. Patches
 * `handleWelcomeCtaClicked` to ask first.
 */
export function patchWelcomeButton(): void {
	const Welcome = metro.findByProps('pickWelcomeSticker', 'handleWelcomeCtaClicked');

	if (typeof Welcome?.handleWelcomeCtaClicked !== 'function') {
		logger.warn('Greet sticker picker skipped: Discord moved handleWelcomeCtaClicked.');

		return;
	}

	patcher.instead(Welcome, 'handleWelcomeCtaClicked', ({ args, original, this: self }) => {
		const [channel, message] = args as WelcomeArgs;
		const stickers = greetStickers<GreetSticker>((id) => Welcome.pickWelcomeSticker(id));

		if (!stickers.length) return original.apply(self, args);

		openGreetSheet(stickers, (sticker) => original.call(self, channel, message, sticker.id));
	});
}
