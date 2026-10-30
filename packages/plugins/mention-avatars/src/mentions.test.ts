import { describe, expect, test } from 'bun:test';

import {
	avatarPngURL,
	containsMentionText,
	extractMentionTokens,
	rebuildsFromLiveText,
	roleImageSource,
	selectMentionLabel,
} from '~/mentions';

describe('extractMentionTokens', () => {
	test('preserves message order for adjacent user and role mentions', () => {
		expect(extractMentionTokens('Hi <@123> and <@&456>')).toEqual([
			{ id: '123', type: 'user' },
			{ id: '456', type: 'role' },
		]);
	});

	test('reads legacy nickname mentions as user mentions', () => {
		expect(extractMentionTokens('<@!789>')).toEqual([{ id: '789', type: 'user' }]);
	});
});

describe('selectMentionLabel', () => {
	test('matches the complete visible label instead of a shared prefix', () => {
		expect(selectMentionLabel('@autosupport', ['auto', 'autosupport'])).toBe('autosupport');
		expect(selectMentionLabel('@dylib.dev\u2069', ['autosupport', 'dylib.dev'])).toBe(
			'dylib.dev',
		);
		expect(selectMentionLabel('@autosupporter', ['autosupport'])).toBeUndefined();
	});
});

describe('selectMentionLabel on ContentNode text', () => {
	test('matches a label followed by the word joiner Discord now renders after mentions', () => {
		expect(
			selectMentionLabel('@adri\u00e1n\u2060 \u2069 hi', ['adri\u00e1n', 'dylib.dev']),
		).toBe('adri\u00e1n');
	});

	test('still rejects a label that continues into more visible text', () => {
		expect(selectMentionLabel('@adri\u00e1nx\u2060', ['adri\u00e1n'])).toBeUndefined();
	});
});

describe('containsMentionText', () => {
	test('requires every mention label to appear in full', () => {
		expect(
			containsMentionText('@autosupport @dylib.dev', [
				{ labels: ['autosupport'], type: 'user' },
				{ labels: ['dylib.dev'], type: 'user' },
			]),
		).toBe(true);
		expect(
			containsMentionText('@autosupporter', [{ labels: ['autosupport'], type: 'user' }]),
		).toBe(false);
	});

	test('finds a complete label after a partial match', () => {
		expect(
			containsMentionText('@autosupporter @autosupport', [
				{ labels: ['autosupport'], type: 'user' },
			]),
		).toBe(true);
	});
});

describe('roleImageSource', () => {
	test('falls back to role color when the role has no custom icon', () => {
		expect(roleImageSource({ id: '123', color: 0x336699, icon: null })).toEqual({
			avatarURL: undefined,
			roleColor: 0x336699,
		});
	});

	test('uses the custom role icon and ignores an unset color', () => {
		expect(roleImageSource({ id: '123', color: 0, icon: 'hash' })).toEqual({
			avatarURL:
				'https://cdn.discordapp.com/role-icons/123/hash.png?size=32&quality=lossless',
			roleColor: undefined,
		});
	});
});

describe('avatarPngURL', () => {
	test('rewrites webp avatars to 32px PNGs', () => {
		expect(avatarPngURL('https://cdn.discordapp.com/avatars/1/a.webp?size=128')).toBe(
			'https://cdn.discordapp.com/avatars/1/a.png?size=32',
		);
	});

	test('adds a size when the URL has none', () => {
		expect(avatarPngURL('https://cdn.discordapp.com/avatars/1/a.png')).toBe(
			'https://cdn.discordapp.com/avatars/1/a.png?size=32',
		);
		expect(avatarPngURL('https://cdn.discordapp.com/avatars/1/a.png?animated=false')).toBe(
			'https://cdn.discordapp.com/avatars/1/a.png?animated=false&size=32',
		);
	});
});

describe('rebuildsFromLiveText', () => {
	test('starts from the live text the first time', () => {
		expect(rebuildsFromLiveText('@adrián hi', undefined)).toBe(true);
	});

	test('reuses the saved original while the view shows our own render', () => {
		expect(rebuildsFromLiveText('\uFFFC@adrián hi', '@adrián hi')).toBe(false);
		expect(rebuildsFromLiveText('@adrián hi', '@adrián hi')).toBe(false);
	});

	test('takes new text Discord set, even when it mentions the same people', () => {
		expect(
			rebuildsFromLiveText('Fixture mention @adrián with a link', '@adrián 352 parity check'),
		).toBe(true);
	});
});
