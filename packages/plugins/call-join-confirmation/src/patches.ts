import { isJoiningOnPurpose } from '@unbound-plugins/shared/voice/intended-join';
import { dialogs, flux, metro, patcher } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

type Channel = { name?: string; recipients?: string[] };

type User = { username?: string; globalName?: string | null };

type ChannelStore = { getChannel(id: string): Channel | undefined };

type UserStore = { getUser(id: string): User | undefined };

type SelectedChannelStore = { getVoiceChannelId(): string | null };

function channelName(channelId: string): string {
	const channel = (flux.getStore('Channel') as unknown as ChannelStore).getChannel(channelId);

	if (channel?.name) return channel.name;

	const users = flux.getStore('User') as unknown as UserStore;
	const names = (channel?.recipients ?? [])
		.map((id) => users.getUser(id))
		.map((user) => user?.globalName || user?.username)
		.filter(Boolean);

	return names.join(', ') || channelId;
}

function confirmThen(title: string, action: string, proceed: () => unknown): Promise<unknown> {
	return new Promise((resolve) => {
		dialogs.showDialog({
			title,
			buttons: [{ label: action, onPress: () => resolve(proceed()) }],
			cancel: true,
			onCancel: () => resolve(undefined),
			onDismiss: () => resolve(undefined),
		});
	});
}

/**
 * @description Asks before joining a voice channel. Patches `selectVoiceChannel`; leaving, staying in the same channel
 * and joins a plugin makes on purpose go through unasked.
 */
export function patchVoiceJoins(): void {
	const Voice = metro.findByProps('selectVoiceChannel', 'selectChannel');
	const Selected = flux.getStore('SelectedChannel') as unknown as SelectedChannelStore;

	if (!Voice?.selectVoiceChannel) {
		logger.warn('Voice join confirmation skipped: Discord moved selectVoiceChannel.');

		return;
	}

	patcher.instead(Voice, 'selectVoiceChannel', ({ args, original }) => {
		const [channelId] = args as [string | null];

		if (
			!settings.voiceChannels ||
			!channelId ||
			isJoiningOnPurpose() ||
			Selected.getVoiceChannelId?.() === channelId
		) {
			return original(...args);
		}

		return confirmThen(
			format('JOIN_TITLE', { name: channelName(channelId) }),
			messages.JOIN,
			() => original(...args),
		);
	});
}

/**
 * @description Asks before starting a call in a DM or group. Patches `call` on Discord's call actions; calls a plugin
 * starts on purpose go through unasked.
 */
export function patchCalls(): void {
	const Calls = metro.findByProps('call', 'ring', 'stopRinging');

	if (!Calls?.call) {
		logger.warn('Call confirmation skipped: Discord moved its call actions.');

		return;
	}

	patcher.instead(Calls, 'call', ({ args, original }) => {
		const [channelId, video] = args as [string | undefined, boolean | undefined];

		if (!settings.calls || !channelId || isJoiningOnPurpose()) return original(...args);

		const title = format(video ? 'CALL_VIDEO_TITLE' : 'CALL_TITLE', {
			name: channelName(channelId),
		});

		return confirmThen(title, messages.CALL, () => original(...args));
	});
}
