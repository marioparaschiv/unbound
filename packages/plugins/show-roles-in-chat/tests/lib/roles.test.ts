import { describe, expect, test } from 'bun:test';

import { roleTag, topRole } from '~/lib/roles';

const dev = { id: '1', name: 'Dev', color: 0x277ecd, position: 10 };
const admin = { id: '2', name: 'Admin', color: 0, position: 4 };
const top = { id: '3', name: 'Top', color: 0, position: 20 };

describe('topRole', () => {
	test('picks the highest role, or the highest coloured one', () => {
		expect(topRole([dev, admin, top], false)).toBe(top);
		expect(topRole([dev, admin, top], true)).toBe(dev);
		expect(topRole([admin, undefined], true)).toBeUndefined();
	});
});

describe('roleTag', () => {
	test('uses the role colour with readable text', () => {
		expect(roleTag(dev)).toEqual({
			text: 'Dev',
			textColor: -1,
			backgroundColor: 0xff277ecd | 0,
		});
		expect(roleTag({ id: '4', name: 'Pale', color: 0xf0f0a0, position: 1 }).textColor).toBe(
			0xff000000 | 0,
		);
		expect(roleTag(admin).backgroundColor).toBe(0xff4e5058 | 0);
	});
});
