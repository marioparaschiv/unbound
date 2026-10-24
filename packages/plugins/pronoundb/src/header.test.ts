import { expect, test } from 'bun:test';

import { addPronouns } from './header';

const IPHONE_WIDTH = 375;

test('keeps a crowded header legible while the accessibility label gets the full pronouns', () => {
	const row = {
		username: 'adrián (@dylib.dev)',
		tagText: 'Owner',
		roleIcon: { name: 'Server Owner' },
		timestamp: '10/5/26, 19:05',
		timestampAccessibilityLabel: 'October 5, 2026 at 19:05',
	};

	addPronouns(row, 'he/him | ISTP | integration engineer', undefined, IPHONE_WIDTH);

	expect(row.timestamp).toBe('10/5/26, 19:05');
	expect(row.timestampAccessibilityLabel).toBe(
		'October 5, 2026 at 19:05 • he/him | ISTP | integration engineer',
	);
});

test('shows the first part of the pronouns when the header has room', () => {
	const row = {
		username: 'adrián',
		timestamp: '10/5/26, 19:05',
		timestampAccessibilityLabel: 'October 5, 2026 at 19:05',
	};

	addPronouns(row, 'he/him | ISTP | integration engineer', undefined, IPHONE_WIDTH);

	expect(row.timestamp).toBe('10/5/26, 19:05 • he/him');
	expect(row.timestampAccessibilityLabel).toBe(
		'October 5, 2026 at 19:05 • he/him | ISTP | integration engineer',
	);
});

test('reserves room for Discord adding the username to the shown name', () => {
	const row = {
		username: 'adrián',
		tagText: 'Owner',
		roleIcon: { name: 'Server Owner' },
		timestamp: '10/5/26, 19:05',
		timestampAccessibilityLabel: 'October 5, 2026 at 19:05',
	};

	addPronouns(row, 'he/him', 'dylib.dev', IPHONE_WIDTH);

	expect(row.timestamp).toBe('10/5/26, 19:05');
	expect(row.timestampAccessibilityLabel).toBe('October 5, 2026 at 19:05 • he/him');
});

test('does not add the pronouns twice when the row is generated again', () => {
	const row = { timestamp: '21:02', timestampAccessibilityLabel: '21:02' };

	addPronouns(row, 'he/him', undefined, IPHONE_WIDTH);
	addPronouns(row, 'he/him', undefined, IPHONE_WIDTH);

	expect(row.timestamp).toBe('21:02 • he/him');
	expect(row.timestampAccessibilityLabel).toBe('21:02 • he/him');
});
