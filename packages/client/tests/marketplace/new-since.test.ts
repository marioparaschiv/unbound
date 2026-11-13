import { beforeEach, expect, test } from 'bun:test';

import { newListingsSince, resetNewListingsSince } from '~/marketplace/new-since';
import { getSetting, setSetting } from '~/settings/unbound';

const DAY_MS = 86_400_000;

beforeEach(() => {
	resetNewListingsSince();
	setSetting('marketplace.lastVisit', 0);
});

test('looks three days back on the first visit and remembers it', () => {
	const now = Date.parse('2026-11-13T12:00:00.000Z');

	expect(newListingsSince(now)).toBe(now - 3 * DAY_MS);
	expect(getSetting('marketplace.lastVisit')).toBe(now);
});

test('keeps the previous visit for the whole session', () => {
	const last = Date.parse('2026-11-10T12:00:00.000Z');
	const now = Date.parse('2026-11-13T12:00:00.000Z');

	setSetting('marketplace.lastVisit', last);

	expect(newListingsSince(now)).toBe(last);
	expect(newListingsSince(now + DAY_MS)).toBe(last);
	expect(getSetting('marketplace.lastVisit')).toBe(now);
});
