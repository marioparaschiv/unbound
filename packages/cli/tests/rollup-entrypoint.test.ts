import { afterEach, expect, test } from 'bun:test';
import { runInThisContext } from 'node:vm';

import { hermesExpressionEntrypoint } from '../src/rollup/entrypoint';

type Chunk = { code: string; type: 'chunk' };

type Context = { id: string };

type Entry = {
	start: (context: Context) => void;
	stop: () => void;
	selfTest: () => Promise<object> | undefined;
	getSettingsPanel?: () => string;
};

const CALLS = '__sharedPluginEntrypointCalls';

afterEach(() => {
	Reflect.deleteProperty(globalThis, CALLS);
});

function record() {
	const calls: (Context | string)[] = [];

	Reflect.set(globalThis, CALLS, calls);

	return calls;
}

function chunk(code: string): Chunk {
	return { code, type: 'chunk' };
}

function generate(hasSettingsPanel: boolean, chunks: Record<string, Chunk>) {
	const hook = hermesExpressionEntrypoint({ hasSettingsPanel }).generateBundle;

	if (typeof hook !== 'function') {
		throw new Error('The entrypoint plugin has no generateBundle hook.');
	}

	Reflect.apply(hook, {}, [{}, chunks, false]);
}

function evaluate(code: string): Entry {
	return runInThisContext(`(${code})`);
}

test('forwards lifecycle methods and context to a default plugin export', () => {
	const calls = record();
	const entry = chunk(
		`({default:{start(context){globalThis.${CALLS}.push(context);},stop(){globalThis.${CALLS}.push("stop");},getSettingsPanel(){return "panel";}}})`,
	);

	generate(true, { entry });

	const plugin = evaluate(entry.code);
	const context = { id: 'plugin' };

	plugin.start(context);
	plugin.stop();

	expect(plugin.getSettingsPanel?.()).toBe('panel');
	expect(calls).toEqual([context, 'stop']);
});

test('forwards lifecycle methods to a namespace export without a default', () => {
	const calls = record();
	const entry = chunk(
		`({start(context){globalThis.${CALLS}.push(context);},stop(){globalThis.${CALLS}.push("stop");},getSettingsPanel(){return "panel";}})`,
	);

	generate(true, { entry });

	const plugin = evaluate(entry.code);
	const context = { id: 'plugin' };

	plugin.start(context);
	plugin.stop();

	expect(plugin.getSettingsPanel?.()).toBe('panel');
	expect(calls).toEqual([context, 'stop']);
});

test('does not advertise a settings panel when the plugin has none', () => {
	for (const code of [
		'({default:{start(){},stop(){}}})',
		'({start(){},stop(){}})',
		'({default:{getSettingsPanel(){return "panel";}}})',
	]) {
		const entry = chunk(code);

		generate(false, { entry });

		expect(evaluate(entry.code).getSettingsPanel).toBeUndefined();
	}
});

test('does not evaluate a plugin merely to check whether it has settings', () => {
	const calls = record();
	const entry = chunk(
		`(()=>{globalThis.${CALLS}.push("loaded");return {default:{start(){}}};})()`,
	);

	generate(false, { entry });

	expect(evaluate(entry.code).getSettingsPanel).toBeUndefined();
	expect(calls).toEqual([]);
});

test('forwards a self-test, and returns nothing for a plugin without one', async () => {
	const withTest = chunk('({default:{selfTest(){return {ok:true,detail:"fine"};}}})');
	const without = chunk('({default:{}})');

	generate(false, { a: withTest, b: without });

	expect(await evaluate(withTest.code).selfTest()).toEqual({ ok: true, detail: 'fine' });
	expect(evaluate(without.code).selfTest()).toBeUndefined();
});
