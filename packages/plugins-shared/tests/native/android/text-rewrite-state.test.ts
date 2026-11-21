import type { NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';
import { describe, expect, test } from 'bun:test';

import { isComponentView, type State } from '~/native/android/text-rewrite-state';

const handle = (id: string) => ({ type: 'handle', id }) as unknown as NativeJavaReference;

function fakeState(components: Set<string>) {
	const calls: string[] = [];
	const java = {
		invoke(target: { id: string }, method: string) {
			calls.push(`${target.id}.${method}`);

			if (method === 'getClass') return handle(`class:${target.id.split('#')[0]}`);
			if (method === 'getName')
				return { type: 'string', value: target.id.slice('class:'.length) };
			if (method === 'getComponentType' && components.has(target.id.split('#')[0]!))
				return null;

			throw new Error(`No method ${method} on ${target.id}`);
		},
	} as unknown as NativeJavaBridge;

	return { state: { java, componentViewClasses: new Map() } as unknown as State, calls };
}

describe('isComponentView', () => {
	test('tells Discord component views from other views', () => {
		const { state } = fakeState(new Set(['r9.TextDisplay']));

		expect(isComponentView(state, handle('r9.TextDisplay#1'))).toBe(true);
		expect(isComponentView(state, handle('android.widget.LinearLayout#2'))).toBe(false);
	});

	test('asks once per class', () => {
		const { state, calls } = fakeState(new Set());

		isComponentView(state, handle('android.widget.LinearLayout#1'));
		isComponentView(state, handle('android.widget.LinearLayout#2'));

		expect(calls.filter((call) => call.endsWith('getComponentType'))).toHaveLength(1);
	});
});
