import { describe, expect, test } from 'bun:test';

import { addPlatforms, platformSuffix, type MessageRow } from '~/header';

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

		addPlatforms(message, desktopAndMobile, 390);

		expect(message.timestamp).toBe('Today at 12:00 • 🖥️📱');
		expect(message.timestampAccessibilityLabel).toBe(
			'Today at 12:00 • Online on Desktop and Mobile',
		);
	});

	test('is idempotent', () => {
		const message = row();

		addPlatforms(message, desktopAndMobile, 390);
		addPlatforms(message, desktopAndMobile, 390);

		expect(message.timestamp).toBe('Today at 12:00 • 🖥️📱');
		expect(message.timestampAccessibilityLabel).toBe(
			'Today at 12:00 • Online on Desktop and Mobile',
		);
	});

	test('keeps the label but skips the symbols when the header is full', () => {
		const message = row({ username: 'a'.repeat(30), tagText: 'BOT' });

		addPlatforms(message, desktopAndMobile, 390);

		expect(message.timestamp).toBe('Today at 12:00');
		expect(message.timestampAccessibilityLabel).toEndWith('Online on Desktop and Mobile');
	});

	test('leaves rows without platforms or a timestamp alone', () => {
		const empty = row();
		const timeless = row({ timestamp: undefined });

		addPlatforms(empty, [], 390);
		addPlatforms(timeless, desktopAndMobile, 390);

		expect(empty).toEqual(row());
		expect(timeless).toEqual(row({ timestamp: undefined }));
	});
});
