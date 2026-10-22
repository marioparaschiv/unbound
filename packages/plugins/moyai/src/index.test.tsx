import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

const listeners = new Map<string, (event: any) => void>();
const settings = new Map<string, unknown>();
const played: number[] = [];
const stopped: number[] = [];
let selectedChannelId = 'botcave';

const soundManager = {
	prepare(
		_url: string,
		_category: string,
		_id: number,
		callback: (error: unknown, metadata?: { duration?: number }) => void,
	) {
		callback(null, { duration: 0.02 });
	},
	play(id: number) {
		played.push(id);
		return Promise.resolve();
	},
	stop(id: number) {
		stopped.push(id);
	},
};

mock.module('@unbound-app/api', () => ({
	metro: {
		common: { ReactNative: { NativeModules: { DCDSoundManager: soundManager } } },
		findByProps: (...properties: string[]) =>
			properties.includes('getChannelId')
				? { getChannelId: () => selectedChannelId }
				: {
						subscribe: (event: string, listener: (event: any) => void) => {
							listeners.set(event, listener);
						},
						unsubscribe: (event: string) => {
							listeners.delete(event);
						},
					},
	},
	storage: {
		getStore: () => ({
			get: (key: string, fallback: unknown) => settings.get(key) ?? fallback,
			set: (key: string, value: unknown) => settings.set(key, value),
			useSettingsStore: () => ({
				get: (key: string, fallback: unknown) => settings.get(key) ?? fallback,
				set: (key: string, value: unknown) => settings.set(key, value),
			}),
		}),
	},
}));

mock.module('@shared/settings-ui', () => ({
	SettingsScrollView: () => null,
	SettingsSection: () => null,
	SettingsSwitchRow: () => null,
}));

const { default: plugin, countMoyai, isMoyaiReaction } = await import('@moyai/index');

function emit(event: string, payload: unknown): void {
	listeners.get(event)?.(payload);
}

beforeEach(() => {
	plugin.stop();
	settings.clear();
	played.length = 0;
	stopped.length = 0;
	selectedChannelId = 'botcave';
});

afterEach(() => plugin.stop());

describe('Moyai matching', () => {
	test('matches Unicode and static or animated custom emoji', () => {
		expect(countMoyai('🗿 <:moai:123> <a:BigMoyai:456>')).toBe(3);
		expect(countMoyai('🗿🗿')).toBe(2);
		expect(countMoyai('moyai <:stone:123>')).toBe(0);
		expect(countMoyai(null)).toBe(0);
	});

	test('matches only Moyai reaction names', () => {
		expect(isMoyaiReaction('🗿')).toBe(true);
		expect(isMoyaiReaction('BigMoyai')).toBe(true);
		expect(isMoyaiReaction('moai')).toBe(true);
		expect(isMoyaiReaction('stone')).toBe(false);
	});
});

describe('Moyai lifecycle', () => {
	test('subscribes and plays only messages in the selected channel', async () => {
		plugin.start();
		expect(listeners.has('MESSAGE_CREATE')).toBe(true);
		emit('MESSAGE_CREATE', { channelId: 'other', message: { content: '🗿' } });
		emit('MESSAGE_CREATE', { channelId: 'botcave', message: { content: '🗿', state: 1 } });
		expect(played).toEqual([]);
		emit('MESSAGE_CREATE', { channel_id: 'botcave', message: { content: '🗿' } });
		await Bun.sleep(10);
		expect(played).toEqual([6969]);
	});

	test('staggers multiple matches', async () => {
		plugin.start();
		emit('MESSAGE_CREATE', { channelId: 'botcave', message: { content: '🗿🗿' } });
		await Bun.sleep(30);
		expect(played).toHaveLength(1);
		await Bun.sleep(370);
		expect(played).toHaveLength(2);
	});

	test('converts sound metadata seconds to playback milliseconds', async () => {
		plugin.start();
		emit('MESSAGE_CREATE', { channelId: 'botcave', message: { content: '🗿' } });
		await Bun.sleep(10);
		expect(played).toHaveLength(1);
		expect(stopped).toHaveLength(0);
		await Bun.sleep(35);
		expect(stopped).toEqual([6969]);
	});

	test('deduplicates reactions and obeys the reaction setting', async () => {
		plugin.start();
		const reaction = { channelId: 'botcave', messageId: 'message', emoji: { name: '🗿' } };
		emit('MESSAGE_REACTION_ADD', reaction);
		emit('MESSAGE_REACTION_ADD', reaction);
		expect(played).toHaveLength(1);
		await Bun.sleep(520);
		emit('MESSAGE_REACTION_ADD', reaction);
		expect(played).toHaveLength(2);
		settings.set('allowReactions', false);
		emit('MESSAGE_REACTION_ADD', { ...reaction, messageId: 'another' });
		expect(played).toHaveLength(2);
	});

	test('removes subscriptions and pending playback on stop', async () => {
		plugin.start();
		emit('MESSAGE_CREATE', { channelId: 'botcave', message: { content: '🗿🗿🗿' } });
		await Bun.sleep(20);
		plugin.stop();
		expect(listeners.size).toBe(0);
		await Bun.sleep(750);
		expect(played).toHaveLength(1);
		expect(stopped).toContain(6969);
	});
});
