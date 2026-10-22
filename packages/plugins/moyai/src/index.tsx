import { SettingsScrollView, SettingsSection, SettingsSwitchRow } from '@shared/settings-ui';
import { metro, storage } from '@unbound-app/api';

const ADDON_ID = 'unbound.moyai';
const SOUND_URL =
	'https://raw.githubusercontent.com/MeguminSama/VencordPlugins/0814f506c4d7ca261644cc12eac996d4f2ee0155/plugins/moyai/moyai.mp3';
const SOUND_ID = 6969;
const DEFAULT_DURATION = 1000;
const MESSAGE_INTERVAL = 350;
const REACTION_DEBOUNCE = 500;
const MESSAGE_PATTERN = /🗿|<a?:.*?moy?ai.*?:\d+>/gi;
const REACTION_PATTERN = /moy?ai/i;
const STORE = storage.getStore(ADDON_ID);

type MessageEvent = {
	channelId?: unknown;
	channel_id?: unknown;
	message?: {
		channel_id?: unknown;
		content?: unknown;
		state?: unknown;
	};
};

type ReactionEvent = {
	channelId?: unknown;
	channel_id?: unknown;
	messageId?: unknown;
	message_id?: unknown;
	emoji?: { name?: unknown };
};

type Dispatcher = {
	subscribe: (event: string, listener: (event: any) => void) => void;
	unsubscribe?: (event: string, listener: (event: any) => void) => void;
};

type SelectedChannelStore = {
	getChannelId: () => string | null | undefined;
};

type SoundMetadata = { duration?: number };

type SoundManager = {
	prepare: (
		url: string,
		category: string,
		id: number,
		callback: (error: unknown, metadata?: SoundMetadata) => void,
	) => void;
	play: (id: number) => Promise<unknown> | unknown;
	stop: (id: number) => void;
};

let started = false;
let lifecycle = 0;
let playing = false;
let prepared = false;
let preparing = false;
let playSequence = 0;
let soundDuration = DEFAULT_DURATION;
let soundManager: SoundManager | null = null;
let dispatcher: Dispatcher | null = null;
let selectedChannelStore: SelectedChannelStore | null = null;
let playbackTimeout: ReturnType<typeof setTimeout> | null = null;
const messageTimeouts = new Set<ReturnType<typeof setTimeout>>();
const recentReactions = new Map<string, ReturnType<typeof setTimeout>>();

export function countMoyai(content: unknown): number {
	return typeof content === 'string' ? (content.match(MESSAGE_PATTERN)?.length ?? 0) : 0;
}

export function isMoyaiReaction(name: unknown): boolean {
	return typeof name === 'string' && (name === '🗿' || REACTION_PATTERN.test(name));
}

function eventChannelId(event: MessageEvent | ReactionEvent): string | null {
	const channelId = event.channelId ?? event.channel_id;
	if (typeof channelId === 'string') return channelId;
	if ('message' in event && typeof event.message?.channel_id === 'string') {
		return event.message.channel_id;
	}
	return null;
}

function inSelectedChannel(event: MessageEvent | ReactionEvent): boolean {
	const channelId = eventChannelId(event);
	return channelId !== null && channelId === selectedChannelStore?.getChannelId();
}

function prepareSound(): void {
	if (!soundManager || prepared || preparing) return;
	preparing = true;
	const generation = lifecycle;
	try {
		soundManager.prepare(SOUND_URL, 'media', SOUND_ID, (error, metadata) => {
			if (!started || generation !== lifecycle) return;
			preparing = false;
			if (error) {
				console.error('Moyai sound preparation failed:', error);
				return;
			}
			const duration = metadata?.duration;
			soundDuration =
				typeof duration === 'number' && Number.isFinite(duration) && duration > 0
					? duration * 1000
					: DEFAULT_DURATION;
			prepared = true;
		});
	} catch (error) {
		preparing = false;
		console.error('Moyai sound preparation failed:', error);
	}
}

async function playSound(): Promise<void> {
	if (!started || !soundManager) return;
	if (!prepared) {
		prepareSound();
		return;
	}
	const sequence = ++playSequence;
	if (playbackTimeout) clearTimeout(playbackTimeout);
	playbackTimeout = null;
	try {
		if (playing) soundManager.stop(SOUND_ID);
		playing = true;
		await soundManager.play(SOUND_ID);
		if (!started || sequence !== playSequence) return;
		playbackTimeout = setTimeout(() => {
			if (sequence !== playSequence) return;
			playing = false;
			playbackTimeout = null;
			soundManager?.stop(SOUND_ID);
		}, soundDuration);
	} catch (error) {
		if (sequence === playSequence) playing = false;
		console.error('Moyai sound playback failed:', error);
	}
}

function onMessage(event: MessageEvent): void {
	if (!inSelectedChannel(event) || event.message?.state) return;
	const count = countMoyai(event.message?.content);
	for (let index = 0; index < count; index++) {
		const timeout = setTimeout(() => {
			messageTimeouts.delete(timeout);
			void playSound();
		}, index * MESSAGE_INTERVAL);
		messageTimeouts.add(timeout);
	}
}

function onReaction(event: ReactionEvent): void {
	if (!STORE.get('allowReactions', true) || !inSelectedChannel(event)) return;
	const name = event.emoji?.name;
	if (!isMoyaiReaction(name)) return;
	const messageId = event.messageId ?? event.message_id;
	const key = `${String(messageId)}:${name}`;
	if (recentReactions.has(key)) return;
	const timeout = setTimeout(() => recentReactions.delete(key), REACTION_DEBOUNCE);
	recentReactions.set(key, timeout);
	void playSound();
}

function start(): void {
	if (started) return;
	started = true;
	lifecycle++;
	const nativeModules = metro.common.ReactNative.NativeModules as Record<string, unknown>;
	const candidate = nativeModules.DCDSoundManager as SoundManager | undefined;
	if (
		candidate &&
		typeof candidate.prepare === 'function' &&
		typeof candidate.play === 'function' &&
		typeof candidate.stop === 'function'
	) {
		soundManager = candidate;
		prepareSound();
	} else {
		console.error('Moyai sound manager is unavailable.');
	}
	selectedChannelStore = metro.findByProps('getChannelId') as SelectedChannelStore | null;
	dispatcher = metro.findByProps('dispatch', 'subscribe') as Dispatcher | null;
	dispatcher?.subscribe('MESSAGE_CREATE', onMessage);
	dispatcher?.subscribe('MESSAGE_REACTION_ADD', onReaction);
}

function stop(): void {
	if (!started) return;
	started = false;
	lifecycle++;
	playSequence++;
	dispatcher?.unsubscribe?.('MESSAGE_CREATE', onMessage);
	dispatcher?.unsubscribe?.('MESSAGE_REACTION_ADD', onReaction);
	for (const timeout of messageTimeouts) clearTimeout(timeout);
	for (const timeout of recentReactions.values()) clearTimeout(timeout);
	if (playbackTimeout) clearTimeout(playbackTimeout);
	messageTimeouts.clear();
	recentReactions.clear();
	playbackTimeout = null;
	if (playing) soundManager?.stop(SOUND_ID);
	playing = false;
	preparing = false;
	soundManager = null;
	dispatcher = null;
	selectedChannelStore = null;
}

function MoyaiSettings() {
	const settings = STORE.useSettingsStore();
	return (
		<SettingsScrollView>
			<SettingsSection title='General'>
				<SettingsSwitchRow
					label='Play on reactions'
					description='Play the sound when someone reacts with Moyai.'
					value={settings.get('allowReactions', true)}
					onValueChange={(value: boolean) => settings.set('allowReactions', value)}
				/>
			</SettingsSection>
		</SettingsScrollView>
	);
}

export default { start, stop, getSettingsPanel: () => <MoyaiSettings /> };
