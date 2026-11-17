import { describe, expect, test } from 'bun:test';

import { isSilenced, ringsSelf, stopRingingSelf, type CallAction } from '~/lib/silence';

const rules = { users: new Set(['100']), groups: new Set(['900']) };

describe('isSilenced', () => {
	test('silences a DM with a picked user', () => {
		expect(isSilenced({ id: '1', type: 1, recipients: ['100'] }, rules)).toBe(true);
	});

	test('lets a DM with anyone else ring', () => {
		expect(isSilenced({ id: '1', type: 1, recipients: ['200'] }, rules)).toBe(false);
	});

	test('silences a picked group DM', () => {
		expect(isSilenced({ id: '900', type: 3, recipients: ['200', '300'] }, rules)).toBe(true);
	});

	test('lets other group DMs ring, even with a picked user in them', () => {
		expect(isSilenced({ id: '901', type: 3, recipients: ['100', '300'] }, rules)).toBe(false);
	});

	test('never silences server channels or unknown channels', () => {
		expect(isSilenced({ id: '900', type: 2 }, rules)).toBe(false);
		expect(isSilenced(undefined, rules)).toBe(false);
	});
});

describe('stopRingingSelf', () => {
	test('drops only the current user from ongoing rings', () => {
		const action: CallAction = { channelId: '1', ongoingRings: { '2': 1, '3': 1 } };

		expect(ringsSelf(action, '2')).toBe(true);
		stopRingingSelf(action, '2');
		expect(action.ongoingRings).toEqual({ '3': 1 });
		expect(ringsSelf(action, '2')).toBe(false);
	});

	test('drops only the current user from a ringing list', () => {
		const action: CallAction = { channelId: '1', ringing: ['1', '2', '3'] };

		stopRingingSelf(action, '2');
		expect(action.ringing).toEqual(['1', '3']);
	});
});
