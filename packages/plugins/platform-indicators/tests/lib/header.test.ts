import { describe, expect, test } from 'bun:test';

import { addPlatforms, platformSuffix, type MessageRow } from '~/lib/header';

const desktopAndMobile = [
	{ platform: 'desktop', status: 'online' },
	{ platform: 'mobile', status: 'idle' },
];

function row(overrides: Partial<MessageRow> = {}): MessageRow {
	return {
		timestamp: 'Today at 12:00',
		timestampAccessibilityLabel: 'Today at 12:00',
		username: 'adrian',
		...overrides,
	};
}

describe('platformSuffix', () => {
	test('joins the symbols of each platform', () => {
		expect(platformSuffix(desktopAndMobile)).toBe('🖥️📱');
		expect(platformSuffix([])).toBe('');
	});
});

describe('addPlatforms', () => {
	test('adds symbols to the timestamp and words to its label', () => {
		const message = row();

		addPlatforms(message, desktopAndMobile, 'en-US');

		expect(message.timestamp).toBe('Today at 12:00 • 🖥️📱');
		expect(message.timestampAccessibilityLabel).toBe(
			'Today at 12:00 • Online on Desktop and Mobile',
		);
	});

	test('is idempotent', () => {
		const message = row();

		addPlatforms(message, desktopAndMobile, 'en-US');
		addPlatforms(message, desktopAndMobile, 'en-US');

		expect(message.timestamp).toBe('Today at 12:00 • 🖥️📱');
		expect(message.timestampAccessibilityLabel).toBe(
			'Today at 12:00 • Online on Desktop and Mobile',
		);
	});

	test('adds the symbols even when the name is long, since Discord shortens the name', () => {
		const message = row({ username: 'a'.repeat(30) });

		addPlatforms(message, desktopAndMobile, 'en-US');

		expect(message.timestamp).toBe('Today at 12:00 • 🖥️📱');
	});

	test('leaves rows without platforms or a timestamp alone', () => {
		const empty = row();
		const timeless = row({ timestamp: undefined });

		addPlatforms(empty, [], 'en-US');
		addPlatforms(timeless, desktopAndMobile, 'en-US');

		expect(empty).toEqual(row());
		expect(timeless).toEqual(row({ timestamp: undefined }));
	});
});
