import { describe, expect, test } from 'bun:test';

import { parsePinned, pinnedShortcuts, setPinned, type Shortcut } from '~/lib/shortcuts';

const available: Shortcut[] = [
	{ id: 'plugin:a', kind: 'plugin', label: 'A', pluginId: 'a' },
	{ id: 'command:roll', kind: 'command', label: '/roll', command: 'roll' },
];

describe('pinned shortcuts', () => {
	test('reads storage safely', () => {
		expect(parsePinned(['plugin:a', 3, 'plugin:a', null, 'command:roll'])).toEqual([
			'plugin:a',
			'command:roll',
		]);
		expect(parsePinned('nope')).toEqual([]);
	});

	test('pins at the end and unpins', () => {
		expect(setPinned(['plugin:a'], 'command:roll', true)).toEqual(['plugin:a', 'command:roll']);
		expect(setPinned(['plugin:a', 'command:roll'], 'plugin:a', false)).toEqual([
			'command:roll',
		]);
		expect(setPinned(['plugin:a', 'command:roll'], 'plugin:a', true)).toEqual([
			'command:roll',
			'plugin:a',
		]);
	});

	test('keeps pinned order and drops what no longer exists', () => {
		expect(
			pinnedShortcuts(['command:roll', 'plugin:gone', 'plugin:a'], available).map(
				(s) => s.id,
			),
		).toEqual(['command:roll', 'plugin:a']);
	});
});
