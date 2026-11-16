import { guardSends } from '@unbound-plugins/shared/composer/held-send';
import { settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';

import { startCountdown } from '~/lib/countdown';

let nextHold = 0;

function sendingText(seconds: number): string {
	return messages.SENDING.replace('{seconds}', String(seconds));
}

function holdSend(): Promise<boolean> {
	return new Promise((resolve) => {
		const id = `undo-send-${nextHold++}`;
		const toast = toasts.show({
			id,
			content: sendingText(settings.seconds),
			duration: 0,
			icon: 'TimerIcon',
			buttons: [
				{
					content: messages.UNDO,
					onPress: () => {
						countdown.cancel();
						toast.close();
						resolve(false);
					},
				},
			],
		});
		const countdown = startCountdown({
			seconds: settings.seconds,
			onTick: (left) => toast.update({ content: sendingText(left) }),
			onDone: () => {
				toast.close();
				resolve(true);
			},
		});
	});
}

/**
 * @description Holds each message for the chosen number of seconds before Discord sends it, with a toast whose Undo
 * button puts the message back in the chat input instead.
 */
export function patchSends(): void {
	guardSends('Undo Send', holdSend);
}

export default { patchSends };
