import { metro, patcher } from '@unbound-app/api';

/** A locally initiated server deletion can emit an optimistic delete and a gateway confirmation. */
export function trackLocalDeletes(): {
	isConfirmation: (channelId: string, messageId: string) => boolean;
	dismiss: (channelId: string, messageId: string) => void;
	stop: () => void;
} {
	const pending = new Map<string, number>();
	const key = (channel: string, message: string) => `${channel}:${message}`;
	const messages = metro.api.Messages;
	let unpatch: (() => void) | undefined;
	if (typeof messages?.deleteMessage === 'function') {
		unpatch = patcher.before(messages, 'deleteMessage', ({ args }) => {
			const [channelId, messageId, options] = args;
			if (typeof channelId !== 'string' || typeof messageId !== 'string') return;
			const id = key(channelId, messageId);
			// Discord's ephemeral Dismiss uses onlyLocal; it must never be swallowed as confirmation.
			const onlyLocal =
				options === true || options?.onlyLocal === true || options?.localOnly === true;
			if (onlyLocal) pending.delete(id);
			else {
				const now = Date.now();
				for (const [oldId, expires] of pending) if (expires < now) pending.delete(oldId);
				if (pending.size >= 500) pending.delete(pending.keys().next().value!);
				pending.set(id, now + 30000);
			}
			// Do not change arguments, return values, the request, or server-side deletion behavior.
		});
	}
	return {
		isConfirmation(channelId, messageId) {
			const id = key(channelId, messageId);
			const deadline = pending.get(id);
			pending.delete(id); // One confirmation per locally initiated operation.
			return deadline !== undefined && deadline >= Date.now();
		},
		dismiss(channelId, messageId) {
			pending.delete(key(channelId, messageId));
		},
		stop() {
			pending.clear();
			unpatch?.();
		},
	};
}
