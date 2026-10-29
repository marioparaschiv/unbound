import { describe, expect, mock, test } from 'bun:test';

type Exports = Record<string, unknown>;
type Listener = (exports: Exports) => void;
type SearchOptions = { all?: boolean; initialize?: boolean };

const listeners = new Set<Listener>();
const searches: SearchOptions[] = [];
const loaded: Exports = { useMediaShareActions: () => 'loaded' };

void mock.module('@unbound-app/api', () => ({
	metro: {
		filters: {
			byProps: (prop: string) => (mdl: Exports) => mdl[prop] !== undefined,
		},
		findByProps: () => ({}),
		findByFilePath: () => ({}),
		find(_: unknown, options: SearchOptions) {
			searches.push(options);

			return [loaded];
		},
		addListener(listener: Listener) {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
	},
	patcher: { createPatcher: () => ({}) },
}));

const { onMediaShareActions } = await import('./modules');

function load(exports: Exports) {
	for (const listener of listeners) listener(exports);
}

describe('onMediaShareActions', () => {
	test('passes loaded copies at once and later copies as Discord loads them, loading none', () => {
		const found: Exports[] = [];
		const stop = onMediaShareActions((module) => found.push(module));
		const later = { useMediaShareActions: () => 'later' };
		const wrapped = { useMediaShareActions: () => 'wrapped' };

		load({ unrelated: true });
		load(later);
		load(later);
		load({ default: wrapped });
		stop();
		load({ useMediaShareActions: () => 'after stop' });

		expect(found).toEqual([loaded, later, wrapped]);
		expect(searches).toEqual([{ all: true, initialize: false }]);
		expect(listeners.size).toBe(0);
	});
});
