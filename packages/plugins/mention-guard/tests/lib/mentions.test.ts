import { describe, expect, test } from 'bun:test';

import { countMentions, needsConfirmation } from '~/lib/mentions';

describe('countMentions', () => {
	test('counts broad pings and different people and roles', () => {
		expect(countMentions('@everyone hi <@1> <@!1> <@2> <@&3>')).toEqual({
			broad: ['@everyone'],
			users: 2,
			roles: 1,
		});
	});

	test('ignores mentions in code', () => {
		expect(countMentions('`@here` ```\n<@1> <@&2>\n```')).toEqual({
			broad: [],
			users: 0,
			roles: 0,
		});
	});
});

describe('needsConfirmation', () => {
	const limits = { broad: true, users: 5, roles: 2 };

	test('asks for a broad ping, many people or many roles', () => {
		expect(needsConfirmation({ broad: ['@here'], users: 0, roles: 0 }, limits)).toBe(true);
		expect(needsConfirmation({ broad: [], users: 5, roles: 0 }, limits)).toBe(true);
		expect(needsConfirmation({ broad: [], users: 0, roles: 2 }, limits)).toBe(true);
	});

	test('lets ordinary messages through', () => {
		expect(needsConfirmation({ broad: [], users: 4, roles: 1 }, limits)).toBe(false);
		expect(
			needsConfirmation(
				{ broad: ['@here'], users: 0, roles: 0 },
				{ ...limits, broad: false },
			),
		).toBe(false);
	});
});
