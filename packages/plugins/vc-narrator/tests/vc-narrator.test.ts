import { settings } from '@unbound-app/settings';
import { flux, native, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

const spoken: string[] = [];

const voiceUpdate = (userId: string, channelId: string | null, oldChannelId: string | null) =>
	flux.dispatch({
		type: 'VOICE_STATE_UPDATES',
		voiceStates: [{ userId, channelId, oldChannelId }],
	} as never);

function registerSpeech() {
	spoken.length = 0;
	native.objc.registerClass('AVSpeechSynthesizer', {
		methods: { 'speakUtterance:': () => undefined, 'stopSpeakingAtBoundary:': () => true },
	});
	native.objc.registerClass('AVSpeechUtterance', {
		classMethods: {
			'speechUtteranceWithString:': (_class, text) => {
				spoken.push(String(text));

				return native.objc.create('AVSpeechUtterance');
			},
		},
		methods: { 'setRate:': () => undefined },
	});
}

beforeEach(() => {
	registerSpeech();
	flux.seed({
		User: {
			getCurrentUser: () => ({ id: 'me' }),
			getUser: (id: string) => ({ id, username: id === 'a' ? 'alice' : id }),
		},
		SelectedChannel: { getVoiceChannelId: () => 'vc' },
		Channel: {
			getChannel: (id: string) => ({ id, name: id === 'vc' ? 'lounge' : 'games', type: 2 }),
		},
		GuildMember: { getNick: () => undefined },
	});
});

describe('the voice channel narrator', () => {
	beforeEach(() => startPlugin());

	test('says who joined, left and moved', async () => {
		await voiceUpdate('a', 'vc', null);
		await voiceUpdate('a', 'g', 'vc');
		await voiceUpdate('a', null, 'vc');

		expect(spoken).toEqual(['alice joined', 'alice moved to games', 'alice left']);
	});

	test('stays quiet for announcements turned off', async () => {
		settings.announce.joins = false;

		await voiceUpdate('a', 'vc', null);

		expect(spoken).toEqual([]);
	});
});
