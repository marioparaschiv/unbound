import { describe, expect, test } from 'bun:test';

import { DEBUG_ALT_PREFIX, packDebugAltText, unpackDebugAltText } from '~/debug-card-alt-text';

const report = {
	unbound: '3.1.0',
	loader: '1.3.0',
	platform: 'iOS',
	state: ['Jailed', 'verified build'],
	entitlements: {
		'application-identifier': 'L5435WB698.com.kdt.livecontainer.L5435WB698',
		'get-task-allow': true,
		'keychain-access-groups': Array.from(
			{ length: 128 },
			(_, index) => `L5435WB698.com.kdt.livecontainer.shared.${index}`,
		),
	},
};

describe('packDebugAltText', () => {
	test('round-trips the report through the packed text', () => {
		expect(unpackDebugAltText(packDebugAltText(report))).toBe(JSON.stringify(report));
	});

	test('packs a large plist far under the JSON length, in BMP characters only', () => {
		const packed = packDebugAltText(report);

		expect(packed.startsWith(DEBUG_ALT_PREFIX)).toBe(true);
		expect(packed.length).toBeLessThan(JSON.stringify(report).length / 10);
		// No surrogates: every character is in the BMP and counts once.
		expect(/[\uD800-\uDFFF]/.test(packed)).toBe(false);
	});

	test('round-trips every payload length, whatever padding the last character holds', () => {
		for (let length = 0; length < 40; length++) {
			const payload = { unbound: 'x'.repeat(length) };

			expect(unpackDebugAltText(packDebugAltText(payload))).toBe(JSON.stringify(payload));
		}
	});
});

describe('unpackDebugAltText', () => {
	test('rejects text that is not packed', () => {
		expect(unpackDebugAltText('{"unbound":"3.1.0"}')).toBeUndefined();
		expect(unpackDebugAltText(`${DEBUG_ALT_PREFIX}abc`)).toBeUndefined();
		expect(unpackDebugAltText(`${DEBUG_ALT_PREFIX}一`)).toBeUndefined();
	});
});
