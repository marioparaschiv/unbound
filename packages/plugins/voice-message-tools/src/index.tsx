import type { PluginContext } from '@unbound-app/api/native';
import { flux, patcher, storage } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { downloadVoiceMessage } from '~/download';
import { parseSpeed } from '~/lib/speed';
import { rememberSpeed, speedForChat, type ChatSpeeds } from '~/lib/chat-speeds';
import { nextSpeed } from '~/lib/speeds';
import { voicePillControls } from '~/native/pill';
import { voiceMessageSpeed } from '~/native/speed';
import { interceptAudioMessages, patchAudioSending } from '~/send';

let speed: ReturnType<typeof voiceMessageSpeed> | undefined;
let pill: ReturnType<typeof voicePillControls> | undefined;
let stopWatching: (() => void) | undefined;
let stopFollowing: (() => void) | undefined;

const CHAT_SPEEDS = 'chatSpeeds';

function chatSpeeds(): ChatSpeeds {
	return storage.getBucket().get(CHAT_SPEEDS, {}) as ChatSpeeds;
}

function currentChannel(): string | undefined {
	return flux.getStore('SelectedChannel')?.getChannelId?.() ?? undefined;
}

function storedSpeed(): string {
	return settings.perChat
		? speedForChat(chatSpeeds(), currentChannel(), settings.speed)
		: settings.speed;
}

function stepSpeed() {
	const channelId = currentChannel();

	if (!settings.perChat || !channelId) {
		settings.speed = nextSpeed(settings.speed);

		return;
	}

	storage
		.getBucket()
		.set(
			CHAT_SPEEDS,
			rememberSpeed(chatSpeeds(), channelId, nextSpeed(storedSpeed()), settings.speed),
		);
}

export function start(context: PluginContext) {
	const chosenSpeed = () => parseSpeed(storedSpeed());

	patchAudioSending();
	interceptAudioMessages();
	speed = voiceMessageSpeed(context.native, chosenSpeed);
	pill = voicePillControls(context.native, chosenSpeed, (action, messageId) => {
		if (action === 'speed') stepSpeed();
		else void downloadVoiceMessage(context.native, messageId);
	});
	stopWatching = storage.onChange(
		({ store }) => store === addon.id,
		() => {
			speed?.refresh();
			pill?.refresh();
		},
	);
	stopFollowing = flux.onAction('CHANNEL_SELECT', () => {
		speed?.refresh();
		pill?.refresh();
	});
}

export function stop() {
	stopFollowing?.();
	stopFollowing = undefined;
	stopWatching?.();
	stopWatching = undefined;
	pill?.dispose();
	pill = undefined;
	speed?.dispose();
	speed = undefined;
	patcher.unpatchAll();
}
