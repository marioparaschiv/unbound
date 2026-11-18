import { describe, expect, test } from 'bun:test';

import { timedStop } from '~/addons/slow-stop';

describe('timedStop', () => {
	function clock(...times: number[]) {
		return () => times.shift() ?? 0;
	}

	test('warns when a stop blocked for more than 2 s, and returns its result', () => {
		const warnings: string[] = [];
		const result = timedStop(
			'Chat Bubbles',
			{ warn: (message: string) => warnings.push(message) },
			() => 7,
			clock(0, 2_500),
		);

		expect(result).toBe(7);
		expect(warnings).toEqual([
			'Chat Bubbles blocked Discord for 2500 ms while it stopped; its stop() should hand slow work off.',
		]);
	});

	test('stays quiet for a quick stop', () => {
		const warnings: string[] = [];

		timedStop(
			'Fast',
			{ warn: (message: string) => warnings.push(message) },
			() => undefined,
			clock(0, 30),
		);

		expect(warnings).toEqual([]);
	});
});
