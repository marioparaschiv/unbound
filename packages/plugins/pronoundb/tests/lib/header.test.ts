import { expect, test } from 'bun:test';

import { addPronouns } from '~/lib/header';

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

test('shows the pronouns in Discord tag pill once, with the chosen colors', () => {
	const row: Parameters<typeof addPronouns>[0] = {
		username: 'adrián',
		timestamp: '10/5/26, 19:05',
	};
	const colors = { background: 0xffff4d6d, text: 0xffffffff };

	addPronouns(row, 'he/him', undefined, IPHONE_WIDTH, 'pill', colors);
	addPronouns(row, 'he/him', undefined, IPHONE_WIDTH, 'pill', colors);

	expect(row).toMatchObject({
		timestamp: '10/5/26, 19:05',
		opTagText: 'he/him',
		opTagBackgroundColor: colors.background,
		opTagTextColor: colors.text,
	});
});

test('falls back to text when the header already has an OP tag', () => {
	const row: Parameters<typeof addPronouns>[0] = {
		username: 'adrián',
		opTagText: 'OP',
		timestamp: '10/5/26, 19:05',
	};

	addPronouns(row, 'he/him', undefined, IPHONE_WIDTH, 'pill');

	expect(row.opTagText).toBe('OP');
	expect(row.timestamp).toBe('10/5/26, 19:05 • he/him');
});

test('falls back to text when the header already has a user tag, which shares the pill', () => {
	const row: Parameters<typeof addPronouns>[0] = {
		username: 'adrián',
		tagText: 'Owner',
		timestamp: '10/5/26, 19:05',
	};

	addPronouns(row, 'he/him', undefined, IPHONE_WIDTH, 'pill');

	expect(row.opTagText).toBeUndefined();
	expect(row.timestamp).toBe('10/5/26, 19:05 • he/him');
});

test('falls back to text next to a connections role tag', () => {
	const row: Parameters<typeof addPronouns>[0] = {
		username: 'adrián',
		connectionsRoleTag: {},
		timestamp: '10/5/26, 19:05',
	};

	addPronouns(row, 'he/him', undefined, IPHONE_WIDTH, 'pill');

	expect(row.opTagText).toBeUndefined();
	expect(row.timestamp).toBe('10/5/26, 19:05 • he/him');
});

test('counts a server tag toward the header width', () => {
	const row: Parameters<typeof addPronouns>[0] = {
		username: 'adrián castro',
		clanTag: '말랑볼살',
		timestamp: '10/5/26, 19:05',
	};

	addPronouns(row, 'he/him', undefined, IPHONE_WIDTH, 'pill');

	expect(row.opTagText).toBeUndefined();
	expect(row.timestamp).toBe('10/5/26, 19:05');
});
