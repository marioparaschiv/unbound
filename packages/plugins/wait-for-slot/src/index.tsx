import { joinOnPurpose } from '@unbound-plugins/shared/voice/intended-join';
import { commands, flux, metro, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { hasSlot } from '~/lib/slot';

type VoiceActions = { selectVoiceChannel(channelId: string | null): void };
type VoiceStates = {
	getVoiceStatesForChannel(channelId: string): Record<string, unknown> | undefined;
};
type Waiting = { channelId: string; name: string };

const VoiceChannels: VoiceActions | undefined = metro.findByProps('selectVoiceChannel', {
	lazy: true,
});
const VOICE_CHANNEL = 2;

let waiting: Waiting | undefined;
let stopListening: (() => void) | undefined;

function connected(channelId: string): number {
	const states = (flux.getStore('VoiceState') as unknown as VoiceStates).getVoiceStatesForChannel(
		channelId,
	);

	return Object.keys(states ?? {}).length;
}

function userLimit(channelId: string): number {
	const channel = flux.getStore('Channel').getChannel(channelId) as
		| { userLimit?: number }
		| undefined;

	return channel?.userLimit ?? 0;
}

function joinIfRoom(): boolean {
	if (
		!waiting ||
		!VoiceChannels ||
		!hasSlot(connected(waiting.channelId), userLimit(waiting.channelId))
	)
		return false;

	const { channelId } = waiting;

	joinOnPurpose(() => VoiceChannels.selectVoiceChannel(channelId));
	waiting = undefined;

	return true;
}

export function start() {
	stopListening = flux.onAction('VOICE_STATE_UPDATES', () => {
		const name = waiting?.name;

		if (name && joinIfRoom())
			toasts.show({ title: addon.name, content: format('JOINED', { name }) });
	});
	commands.register({
		'wait-for-slot': {
			description: 'WAIT_DESC',
			options: {
				channel: commands.option.channel({
					description: 'WAIT_CHANNEL_DESC',
					required: true,
					channelTypes: [VOICE_CHANNEL],
				}),
			},
			execute: ({ channel }) => {
				const name = channel.name ?? channel.id;

				if (userLimit(channel.id) <= 0)
					return { ephemeral: true, content: format('NO_LIMIT', { name }) };

				waiting = { channelId: channel.id, name };

				return {
					ephemeral: true,
					content: joinIfRoom()
						? format('NOT_FULL', { name })
						: format('WAITING', { name }),
				};
			},
		},
		'stop-waiting': {
			description: 'STOP_DESC',
			execute: () => {
				const name = waiting?.name;

				waiting = undefined;

				return {
					ephemeral: true,
					content: name ? format('STOPPED', { name }) : messages.NOT_WAITING,
				};
			},
		},
	});
}

export function stop() {
	stopListening?.();
	stopListening = undefined;
	waiting = undefined;
}
