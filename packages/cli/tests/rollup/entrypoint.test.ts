import { afterEach, expect, test } from 'bun:test';
import { runInThisContext } from 'node:vm';

import { hermesExpressionEntrypoint } from '~/rollup/entrypoint';

type Chunk = { code: string; type: 'chunk' };

// What the test entries export: functions returning a marker string.
type EntryExports = Record<string, () => string>;

type Wrapper = { __load: () => EntryExports };

const CALLS = '__sharedPluginEntrypointCalls';

afterEach(() => {
	Reflect.deleteProperty(globalThis, CALLS);
});

function record() {
	const calls: string[] = [];

	Reflect.set(globalThis, CALLS, calls);

	return calls;
}

function generate(chunks: Record<string, Chunk>) {
	const hook = hermesExpressionEntrypoint().generateBundle;

	if (typeof hook !== 'function') {
		throw new Error('The entrypoint plugin has no generateBundle hook.');
	}

	Reflect.apply(hook, {}, [{}, chunks, false]);
}

function evaluate(code: string): Wrapper {
	return runInThisContext(`(${code})`);
}

test('returns the named exports from __load, evaluating the module once', () => {
	const calls = record();
	const entry: Chunk = {
		type: 'chunk',
		code: `var plugin=function(){globalThis.${CALLS}.push("loaded");return{start(){return "started"},SettingsPanel(){return "panel"}}}();`,
	};

	generate({ entry });

	const wrapper = evaluate(entry.code);

	expect(calls).toEqual([]);
	expect(wrapper.__load().start?.()).toBe('started');
	expect(wrapper.__load().SettingsPanel?.()).toBe('panel');
	expect(calls).toEqual(['loaded']);
});

test('adds no lifecycle methods of its own', () => {
	const entry: Chunk = { type: 'chunk', code: '({start(){}})' };

	generate({ entry });

	expect(Object.keys(evaluate(entry.code))).toEqual(['__plugin', '__load']);
});
