import { mock } from 'bun:test';

type Lookups = typeof import('~/metro/lookups');

const none = () => undefined;

// Each lookup finds nothing, so a test that answers only some of them never reaches a metro search.
const NOTHING: Record<keyof Lookups, (...args: MetroExport[]) => MetroExport> = {
	find: none,
	findByProps: none,
	findByName: none,
	findByFilePath: none,
	findByPrototypes: none,
	findStore: none,
};

/**
 * @description Replaces `~/metro/lookups` with `overrides` over `base`.
 * @param overrides The lookups the test answers itself.
 * @param base The other lookups: ones that find nothing, or the real module for a test over a fake Metro.
 */
export function mockLookups(
	overrides: Partial<Record<keyof Lookups, (...args: MetroExport[]) => MetroExport>>,
	base: Partial<Lookups> = NOTHING,
) {
	mock.module('~/metro/lookups', () => ({ ...NOTHING, ...base, ...overrides }));
}
