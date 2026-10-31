import { expect, mock, test } from 'bun:test';

const rotations: number[] = [];
const platform = { fails: false };
const listeners = new Set<(state: string) => void>();

mock.module('react-native', () => ({
	NativeModules: {},
	AppState: {
		addEventListener: (_event: string, listener: (state: string) => void) => {
			listeners.add(listener);

			return { remove: () => listeners.delete(listener) };
		},
	},
}));
mock.module('~/rotation/platform', () => ({
	rotateScreen: async (_native: unknown, degrees: number) => {
		if (platform.fails) throw new Error('no decor view');

		rotations.push(degrees);

		return true;
	},
}));

const { startRotation } = await import('~/rotation');

test('turns the screen upside down, again on returning to the foreground, and back on stop', async () => {
	const stop = startRotation({} as never, () => {});

	for (const listener of listeners) {
		listener('background');
		listener('active');
	}

	stop();
	await Promise.resolve();

	expect(rotations).toEqual([180, 180, 0]);
	expect(listeners.size).toBe(0);
});

test('reports a rotation that fails instead of throwing', async () => {
	const failures: unknown[] = [];

	platform.fails = true;

	const stop = startRotation({} as never, (error) => failures.push(error));

	await new Promise((resolve) => setTimeout(resolve, 0));
	stop();
	platform.fails = false;

	expect(failures.length).toBeGreaterThan(0);
});
