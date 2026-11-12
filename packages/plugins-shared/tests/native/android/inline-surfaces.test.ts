import { describe, expect, jest, test } from 'bun:test';

import { createInlineSurfaces, type InlineDefinition } from '~/native/android/inline-surfaces';

type FakeValue = {
	type: string;
	value?: string | number | boolean;
};

type Call = {
	method: string;
	args: FakeValue[];
};

type FakeState = {
	calls: Call[];
	needsHost: ((rendered: string) => void) | null;
	scopeDisposed: boolean;
	unmounted: FakeValue[];
	mounted: FakeValue[];
	blank: Set<string>;
};

const handle = (value: string): FakeValue => ({ type: 'handle', value });

function fakeNative(apiVersion: string, state: FakeState) {
	let hosts = 0;

	const java = {
		invoke(target: FakeValue, method: string): FakeValue {
			if (method === 'getChildAt') {
				return handle(`root-${target.value}`);
			}

			if (method === 'getChildCount') {
				const host = String(target.value).replace('root-', '');

				return { type: 'int', value: state.blank.has(host) ? 0 : 1 };
			}

			return handle('context');
		},
		invokeAsync(target: FakeValue, method: string): Promise<FakeValue> {
			return Promise.resolve(java.invoke(target, method));
		},
		construct: () => handle(`host-${hosts++}`),
	};

	return {
		apiVersion,
		java,
		hooks: {},
		ui: {
			createScope: () => ({
				dispose() {
					state.scopeDisposed = true;
				},
			}),
			run(worklet: (...args: unknown[]) => void, ...args: FakeValue[]) {
				state.calls.push({ method: worklet.name, args });
			},
			callback(listener: (rendered: string) => void) {
				state.needsHost = listener;

				return listener;
			},
		},
		fabric: {
			mountAsync(host: FakeValue) {
				state.mounted.push(host);
				state.blank.delete(String(host.value));

				return Promise.resolve(handle(`surface-${host.value}`));
			},
			unmountAsync(surface: FakeValue) {
				state.unmounted.push(surface);

				return Promise.resolve();
			},
		},
	};
}

function setup(apiVersion = '1.4.0') {
	const state: FakeState = {
		calls: [],
		needsHost: null,
		scopeDisposed: false,
		unmounted: [],
		mounted: [],
		blank: new Set(),
	};
	const native: Parameters<typeof createInlineSurfaces>[0] = Object.assign(
		Object.create(null),
		fakeNative(apiVersion, state),
	);

	return { state, surfaces: createInlineSurfaces(native, options) };
}

const definition: InlineDefinition = Object.assign(Object.create(null), {
	original: 'code ```x```',
	rendered: 'code ￼',
	edits: [{ start: 5, end: 12, text: '￼', spacerOffset: 0, width: 10, height: 20 }],
	slots: [{ surfaceId: 'card-0', placeholder: 5, width: 10, height: 18 }],
	textView: handle('text-view'),
});

const options = { watchedClass: 'MessageContentView', surfaceModule: 'Card', groupPrefix: 'test' };

const methods = (state: FakeState) => state.calls.map((call) => call.method);

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createInlineSurfaces', () => {
	test('is unavailable when the loader cannot rewrite hooked arguments or implement interfaces', () => {
		expect(setup('1.3.0').surfaces).toBeNull();
	});

	test('registers the rule, reapplies the text and hands over hosts once they mount', async () => {
		const { state, surfaces } = setup();

		surfaces!.define(definition);

		expect(methods(state)).toEqual(['installTextRewrites', 'putRule', 'reapply']);

		await settled();

		expect(methods(state)).toEqual([
			'installTextRewrites',
			'putRule',
			'reapply',
			'addHost',
			'addHost',
		]);
		expect(surfaces!.isDefined('code ￼')).toBe(true);
	});

	test('remounts a surface that never rendered into its host', async () => {
		jest.useFakeTimers();

		try {
			const { state, surfaces } = setup();

			surfaces!.define(definition);

			for (let tick = 0; tick < 16; tick++) await Promise.resolve();

			const first = state.mounted[0];

			state.blank.add(String(first.value));
			jest.advanceTimersByTime(1_000);

			for (let tick = 0; tick < 16; tick++) await Promise.resolve();

			expect(state.unmounted).toEqual([handle(`surface-${first.value}`)]);
			expect(state.mounted.filter((host) => host.value === first.value)).toHaveLength(2);
			expect(state.mounted).toHaveLength(3);
			expect(methods(state)).toContain('refresh');
		} finally {
			jest.useRealTimers();
		}
	});

	test('waits longer between remounts and stops after three', async () => {
		jest.useFakeTimers();

		try {
			const { state, surfaces } = setup();

			surfaces!.define(definition);

			for (let tick = 0; tick < 16; tick++) await Promise.resolve();

			const first = state.mounted[0];

			async function flush() {
				for (let tick = 0; tick < 16; tick++) await Promise.resolve();
			}

			function remounts() {
				return state.unmounted.filter(
					(surface) => surface.value === `surface-${first.value}`,
				).length;
			}

			state.blank.add(String(first.value));

			for (const [elapsed, expected] of [
				[1_000, 1],
				[1_400, 1],
				[100, 2],
				[2_500, 3],
				[10_000, 3],
			] as const) {
				state.blank.add(String(first.value));
				jest.advanceTimersByTime(elapsed);
				await flush();
				expect(remounts()).toBe(expected);
			}
		} finally {
			jest.useRealTimers();
		}
	});

	test('backs off when its own rule already rewrites the same text differently', async () => {
		const { state, surfaces } = setup();

		surfaces!.define({ ...definition, rendered: 'code ￼￼' });
		await settled();
		state.calls.length = 0;

		expect(surfaces!.define(definition)).toBe(false);
		expect(methods(state)).toEqual(['reapply']);
		expect(surfaces!.isDefined('code ￼')).toBe(false);
	});

	test('adds a group when the loader asks for another host', async () => {
		const { state, surfaces } = setup();

		surfaces!.define(definition);
		state.needsHost?.('code ￼');
		await settled();

		expect(methods(state).filter((method) => method === 'addHost')).toHaveLength(3);
	});

	test('updates anchors and refreshes rows when a slot is resized', async () => {
		const { state, surfaces } = setup();

		surfaces!.define(definition);
		await settled();
		surfaces!.define({ ...definition, slots: [{ ...definition.slots[0], height: 40 }] });

		expect(methods(state).filter((method) => method === 'updateAnchor')).toHaveLength(2);
		expect(methods(state)).toContain('refresh');
	});

	test('does not hand over hosts that mount after dispose', async () => {
		const { state, surfaces } = setup();

		surfaces!.define(definition);
		await surfaces!.dispose();
		await settled();

		expect(methods(state)).not.toContain('addHost');
	});

	test('removes its rules and groups, then tears the rewrites down, on dispose', async () => {
		const { state, surfaces } = setup();

		surfaces!.define(definition);
		await settled();
		await surfaces!.dispose();

		expect(methods(state)).toContain('removeRule');
		expect(methods(state).filter((method) => method === 'removeGroup')).toHaveLength(2);
		expect(methods(state).at(-1)).toBe('disposeTextRewrites');
		expect(state.unmounted).toHaveLength(2);
	});
});
