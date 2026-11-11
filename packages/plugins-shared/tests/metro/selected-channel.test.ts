import { describe, expect, mock, test } from 'bun:test';

const store = {
	selected: undefined as string | undefined,
	last: undefined as string | undefined,
	getChannelId: () => store.selected,
	getLastSelectedChannelId: () => store.last,
};

// Module mocks are process-wide: later test files statically link `metro` and `patcher` against this one.
void mock.module('@unbound-app/api', () => ({
	flux: { getStore: () => store },
	metro: {},
	patcher: {},
}));

const { selectedChannelId } = await import('~/metro/selected-channel');

describe('selectedChannelId', () => {
	test('reads the selected channel, else the last selected one', () => {
		Object.assign(store, { selected: 'c1', last: 'c0' });
		expect(selectedChannelId()).toBe('c1');

		Object.assign(store, { selected: '', last: 'c0' });
		expect(selectedChannelId()).toBe('c0');

		Object.assign(store, { selected: undefined, last: undefined });
		expect(selectedChannelId()).toBeUndefined();
	});
});
