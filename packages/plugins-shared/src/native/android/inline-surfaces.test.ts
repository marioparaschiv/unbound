import { describe, expect, test } from 'bun:test';

import { createInlineSurfaces, type InlineDefinition } from './inline-surfaces';

type FakeValue = {
	type: string;
	value?: string;
};

type Call = {
	method: string;
	args: FakeValue[];
};

type HookContext = {
	args: FakeValue[];
};

type HookHandler = (context: HookContext) => void;

type FakeState = {
	calls: Call[];
	handler: HookHandler | null;
	removed: boolean;
	unmounted: FakeValue[];
};

const handle = (value: string): FakeValue => ({ type: 'handle', value });

function fakeNative(available: boolean, state: FakeState) {
	let hosts = 0;

	return {
		java: {
			getClass(name: string): FakeValue {
				if (!available) {
					throw new Error(`${name} is missing`);
				}

				return { type: 'class', value: name };
			},
			getField: () => handle('rewrites'),
			invoke(target: FakeValue, method: string, args: FakeValue[] = []): FakeValue {
				if (target.value === 'rewrites') {
					state.calls.push({ method, args });
				}

				return handle('context');
			},
			construct: () => handle(`host-${hosts++}`),
		},
		hooks: {
			hook(
				_class: string,
				_method: string,
				_args: string[],
				_options: Record<string, boolean>,
				handler: HookHandler,
			) {
				state.handler = handler;

				return handle('token');
			},
			remove() {
				state.removed = true;
			},
		},
		fabric: {
			mountAsync: (host: FakeValue) => Promise.resolve(handle(`surface-${host.value}`)),
			unmountAsync(surface: FakeValue) {
				state.unmounted.push(surface);

				return Promise.resolve();
			},
		},
	};
}

function setup(available = true) {
	const state: FakeState = { calls: [], handler: null, removed: false, unmounted: [] };
	const native: Parameters<typeof createInlineSurfaces>[0] = Object.assign(
		Object.create(null),
		fakeNative(available, state),
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
	test('is unavailable when the loader has no native text rewrites', () => {
		expect(setup(false).surfaces).toBeNull();
	});

	test('registers the rule, reapplies the text and hands over hosts once they mount', async () => {
		const { state, surfaces } = setup();

		surfaces!.define(definition);

		expect(methods(state)).toEqual(['watch', 'put', 'reapply']);

		await settled();

		expect(methods(state)).toEqual(['watch', 'put', 'reapply', 'addHost', 'addHost']);
		expect(surfaces!.isDefined('code ￼')).toBe(true);
	});

	test('adds a group when the loader asks for another host', async () => {
		const { state, surfaces } = setup();

		surfaces!.define(definition);
		state.handler?.({ args: [handle('other'), { type: 'string', value: 'code ￼' }] });
		await settled();

		expect(methods(state).filter((method) => method === 'addHost')).toHaveLength(3);
	});

	test('updates anchors and refreshes rows when a slot is resized', () => {
		const { state, surfaces } = setup();

		surfaces!.define(definition);
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

	test('removes its rules, groups and hook on dispose', async () => {
		const { state, surfaces } = setup();

		surfaces!.define(definition);
		await surfaces!.dispose();

		expect(methods(state)).toContain('remove');
		expect(methods(state)).toContain('refreshAll');
		expect(methods(state).filter((method) => method === 'removeGroup')).toHaveLength(2);
		expect(state.unmounted).toHaveLength(2);
		expect(state.removed).toBe(true);
	});
});
