import { describe, expect, test } from 'bun:test';

import { detailsOf, formatDuration, formatSize } from '~/lib/details';

describe('formatting', () => {
	test('writes sizes in powers of 1,024', () => {
		expect(formatSize(512)).toBe('512 B');
		expect(formatSize(44150)).toBe('43.1 KB');
		expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
	});

	test('writes durations with hours only when needed', () => {
		expect(formatDuration(65)).toBe('1:05');
		expect(formatDuration(3723)).toBe('1:02:03');
	});
});

describe('detailsOf', () => {
	test('lists what Discord reports, in order', () => {
		expect(
			detailsOf({
				filename: 'SPOILER_a.webp',
				content_type: 'image/webp',
				original_content_type: 'image/png',
				size: 44150,
				width: 640,
				height: 660,
				description: 'a cat',
			}),
		).toEqual([
			{ key: 'name', value: 'SPOILER_a.webp' },
			{ key: 'type', value: 'image/webp' },
			{ key: 'originalType', value: 'image/png' },
			{ key: 'size', value: '43.1 KB' },
			{ key: 'dimensions', value: '640 × 660' },
			{ key: 'altText', value: 'a cat' },
			{ key: 'spoiler', value: '✓' },
		]);
	});

	test('shows a voice message duration', () => {
		expect(detailsOf({ duration_secs: 12.4 })).toEqual([{ key: 'duration', value: '0:12' }]);
	});
});
