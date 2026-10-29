import { describe, expect, test } from 'bun:test';

import { getStaffArea, getStaffSections } from '~/lib/auth/staff-areas';
import type { Role } from '~/lib/auth/access';

type Case = [role: Role, ids: string[]];

type AreaCase = [role: Role, id: string | undefined];

const areaCases: AreaCase[] = [
	['user', undefined],
	['developer', undefined],
	['moderator', 'admin'],
	['admin', 'admin'],
];

const sectionCases: Case[] = [
	['user', []],
	['developer', []],
	['moderator', ['review', 'users', 'addons']],
	['admin', ['review', 'users', 'addons']],
];

function areaId(role: string | null | undefined): string | undefined {
	return getStaffArea(role)?.id;
}

function sectionIds(role: string | null | undefined): string[] {
	return getStaffSections(role).map((section) => section.id);
}

describe('getStaffArea', () => {
	test.each(areaCases)('%s sees %o', (role, area) => {
		expect(areaId(role)).toBe(area);
	});

	test('a comma-separated role sees the highest area any one of its roles grants', () => {
		expect(areaId('developer,moderator')).toBe('admin');
	});

	test('an unset or unknown role sees nothing', () => {
		expect(areaId(null)).toBeUndefined();
		expect(areaId('owner')).toBeUndefined();
	});
});

describe('getStaffSections', () => {
	test.each(sectionCases)('%s opens %o', (role, sections) => {
		expect(sectionIds(role)).toEqual(sections);
	});

	test('an unset or unknown role opens nothing', () => {
		expect(sectionIds(undefined)).toEqual([]);
		expect(sectionIds('owner')).toEqual([]);
	});
});
