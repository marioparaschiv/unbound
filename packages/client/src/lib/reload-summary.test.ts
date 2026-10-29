import { describe, expect, test } from 'bun:test';

import { reloadSummary } from './reload-summary';

describe('reloadSummary', () => {
	test('names one, two or three plugins', () => {
		expect(reloadSummary(['Moyai'])).toBe('Reloaded Moyai.');
		expect(reloadSummary(['Moyai', 'ReviewDB'])).toBe('Reloaded Moyai and ReviewDB.');
		expect(reloadSummary(['Moyai', 'ReviewDB', 'Translate'])).toBe(
			'Reloaded Moyai, ReviewDB and Translate.',
		);
	});

	test('counts the rest once there are more', () => {
		expect(reloadSummary(['A', 'B', 'C', 'D', 'E'])).toBe('Reloaded A, B and 3 more.');
	});

	test('counts a plugin that reloaded twice once', () => {
		expect(reloadSummary(['A', 'A', 'B'])).toBe('Reloaded A and B.');
	});
});
