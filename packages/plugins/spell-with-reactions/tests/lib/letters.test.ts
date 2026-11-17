import { describe, expect, test } from 'bun:test';

import { spell } from '~/lib/letters';

describe('spell', () => {
	test('spells letters with regional indicators', () => {
		expect(spell('hi')).toEqual({ ok: true, emoji: ['🇭', '🇮'] });
	});

	test('uses look-alikes for repeated letters and ignores spaces', () => {
		expect(spell('o o o')).toEqual({ ok: true, emoji: ['🇴', '🅾️', '⭕'] });
	});

	test('skips emoji already on the message', () => {
		expect(spell('a', new Set(['🇦']))).toEqual({ ok: true, emoji: ['🅰️'] });
	});

	test('names letters that repeat too often and characters it cannot spell', () => {
		expect(spell('lll')).toEqual({ ok: false, reason: 'repeats', letters: ['l'] });
		expect(spell('héy')).toEqual({ ok: false, reason: 'unsupported', characters: ['é'] });
		expect(spell('   ')).toEqual({ ok: false, reason: 'empty' });
	});

	test('keeps within the 20 reaction limit', () => {
		expect(spell('abcdefghijklmnopqrstu')).toEqual({
			ok: false,
			reason: 'too-many',
			count: 21,
		});
	});
});
