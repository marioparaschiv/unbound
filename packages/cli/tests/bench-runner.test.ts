import { describe, expect, test } from 'bun:test';

import { ranStaleBundle } from '../src/bench/runner';

const OWN = 'b0eb14f48a819033210c562896e6954a0fb7cd41d401feb0b769513f198fd394';
const STALE = '4ec8aaf162d465959ebc677322cbfb52690eb277226d074b9b1a48117a89c18b';

describe('ranStaleBundle', () => {
	// The 2026-11-01T061947Z run stopped here: a define-stage loader ran the previous variant's bundle.
	test('a warm-up that ran another bundle may fail', () => {
		expect(ranStaleBundle({ discarded: true, ranBundleSha256: STALE }, OWN)).toBe(true);
		expect(ranStaleBundle({ discarded: true, ranBundleSha256: null }, OWN)).toBe(true);
	});

	test('a warm-up that ran its own bundle must not fail', () => {
		expect(ranStaleBundle({ discarded: true, ranBundleSha256: OWN }, OWN)).toBe(false);
	});

	test('a measured launch must not fail', () => {
		expect(ranStaleBundle({ discarded: false, ranBundleSha256: STALE }, OWN)).toBe(false);
	});
});
