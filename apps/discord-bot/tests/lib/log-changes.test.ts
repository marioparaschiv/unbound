import { describe, expect, test } from 'bun:test';
import { PermissionFlagsBits } from 'discord.js';

import { describeChanges, describePermissionChanges, quoteContent } from '~/lib/log-changes';

describe('describeChanges', () => {
	test('lists only the changed settings, with unset ones as none', () => {
		expect(
			describeChanges(
				{ Name: 'icon-packs', Topic: undefined, NSFW: 'no' },
				{ Name: 'icons', Topic: 'Icon packs', NSFW: 'no' },
			),
		).toEqual(['**Name:** icon-packs → icons', '**Topic:** *none* → Icon packs']);
	});
});

describe('describePermissionChanges', () => {
	test('names the permissions added and removed', () => {
		const before = PermissionFlagsBits.KickMembers | PermissionFlagsBits.SendMessages;
		const after = PermissionFlagsBits.BanMembers | PermissionFlagsBits.SendMessages;

		expect(describePermissionChanges(before, after)).toEqual([
			'**Permissions added:** Ban Members',
			'**Permissions removed:** Kick Members',
		]);
		expect(describePermissionChanges(after, after)).toEqual([]);
	});
});

describe('quoteContent', () => {
	test('quotes text, and says when it is empty or unknown', () => {
		expect(quoteContent('hi\nthere')).toBe('> hi\n> there');
		expect(quoteContent('')).toBe('> *No text.*');
		expect(quoteContent(null)).toStartWith('> *Sent before the bot started');
	});
});
