import { guardSends } from '@unbound-plugins/shared/composer/held-send';
import { flux, patcher, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { createQueue } from '~/lib/queue';

type SlowmodeStore = {
	getSlowmodeCooldownGuess(channelId: string, type?: number): number;
	isChannelOnCooldown(channel: unknown, type?: number): boolean;
};

const TICK = 1000;
const SETTLE = 400;
const NEXT_HOLD_DELAY = 1500;

const queue = createQueue();

let nextHold = 0;

function secondsLeft(Slowmode: SlowmodeStore, channelId: string): number {
	return Math.ceil(Slowmode.getSlowmodeCooldownGuess(channelId) / 1000);
}

function waitForCooldown(Slowmode: SlowmodeStore, channelId: string): Promise<boolean> {
	return new Promise((resolve) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const waitingText = () =>
			format('WAITING', { seconds: Math.max(1, secondsLeft(Slowmode, channelId)) });
		const toast = toasts.show({
			id: `slowmode-queue-${nextHold++}`,
			content: waitingText(),
			duration: 0,
			icon: 'HourglassIcon',
			buttons: [
				{
					content: messages.CANCEL,
					onPress: () => {
						clearTimeout(timer);
						toast.close();
						resolve(false);
					},
				},
			],
		});

		function tick() {
			if (secondsLeft(Slowmode, channelId) <= 0) {
				timer = setTimeout(() => {
					toast.close();
					resolve(true);
				}, SETTLE);

				return;
			}

			toast.update({ content: waitingText() });
			timer = setTimeout(tick, TICK);
		}

		tick();
	});
}

/**
 * @description Keeps the send button working while slowmode cools down, by reporting no message cooldown to it, and
 * holds each send until the cooldown ends, one at a time per channel, with a countdown toast whose Cancel puts the
 * message back in the chat input.
 */
export function patchSlowmode(): void {
	const Slowmode = flux.getStore('Slowmode') as unknown as SlowmodeStore;

	patcher.instead(Slowmode, 'isChannelOnCooldown', ({ args, original, this: self }) =>
		args[1] === undefined ? false : original.apply(self, args),
	);

	guardSends('Slowmode Queue', async ([channelId]) => {
		const release = await queue.enqueue(channelId);
		const send =
			secondsLeft(Slowmode, channelId) <= 0 || (await waitForCooldown(Slowmode, channelId));

		setTimeout(release, send ? NEXT_HOLD_DELAY : 0);

		return send;
	});
}

export default { patchSlowmode };
