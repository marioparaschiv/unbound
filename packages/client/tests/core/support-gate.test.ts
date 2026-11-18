import { describe, expect, test } from 'bun:test';

import {
	ANSWERS,
	hoistedRoleIds,
	needsSupportGate,
	shuffledAnswers,
	TRUSTED_ROLE_IDS,
} from '~/core/support-gate';

const roles = [
	{ id: 'staff', hoist: true },
	{ id: 'sponsor', hoist: true },
	{ id: 'ios', hoist: false },
];

describe('hoistedRoleIds', () => {
	test('keeps only the hoisted roles', () => {
		expect([...hoistedRoleIds(roles)]).toEqual(['staff', 'sponsor']);
	});

	test('falls back to the known trusted roles when none can be read', () => {
		expect(hoistedRoleIds(undefined)).toBe(TRUSTED_ROLE_IDS);
		expect(hoistedRoleIds([{ id: 'ios' }])).toBe(TRUSTED_ROLE_IDS);
	});
});

describe('needsSupportGate', () => {
	const hoisted = hoistedRoleIds(roles);

	test('gates every member without a hoisted role, however long they have been around', () => {
		expect(needsSupportGate([], hoisted)).toBe(true);
		expect(needsSupportGate(['ios'], hoisted)).toBe(true);
	});

	test('lets members with a hoisted role through', () => {
		expect(needsSupportGate(['ios', 'sponsor'], hoisted)).toBe(false);
	});
});

describe('shuffledAnswers', () => {
	test('keeps every answer once', () => {
		expect(shuffledAnswers(() => 0.99).sort()).toEqual([...ANSWERS].sort());
		expect(shuffledAnswers(() => 0).sort()).toEqual([...ANSWERS].sort());
	});
});
