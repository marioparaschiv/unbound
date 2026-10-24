import { afterEach, expect, test } from 'bun:test';

import { hermesExpressionEntrypoint } from './entrypoint.mjs';

afterEach(() => {
	delete globalThis.__sharedPluginEntrypointCalls;
});

test('forwards lifecycle methods and context to a default plugin export', () => {
	globalThis.__sharedPluginEntrypointCalls = [];
	const chunk = {
		code: '({default:{start(context){globalThis.__sharedPluginEntrypointCalls.push(context);},stop(){globalThis.__sharedPluginEntrypointCalls.push("stop");},getSettingsPanel(){return "panel";}}})',
		type: 'chunk',
	};
	const bundle = hermesExpressionEntrypoint({ hasSettingsPanel: true });
	bundle.generateBundle({}, { entry: chunk });
	const entry = Function(`return ${chunk.code}`)();
	const context = { id: 'plugin' };

	entry.start(context);
	entry.stop();

	expect(entry.getSettingsPanel()).toBe('panel');
	expect(globalThis.__sharedPluginEntrypointCalls).toEqual([context, 'stop']);
});

test('forwards lifecycle methods to a namespace export without a default', () => {
	globalThis.__sharedPluginEntrypointCalls = [];
	const chunk = {
		code: '({start(context){globalThis.__sharedPluginEntrypointCalls.push(context);},stop(){globalThis.__sharedPluginEntrypointCalls.push("stop");},getSettingsPanel(){return "panel";}})',
		type: 'chunk',
	};
	const bundle = hermesExpressionEntrypoint({ hasSettingsPanel: true });
	bundle.generateBundle({}, { entry: chunk });
	const entry = Function(`return ${chunk.code}`)();
	const context = { id: 'plugin' };

	entry.start(context);
	entry.stop();

	expect(entry.getSettingsPanel()).toBe('panel');
	expect(globalThis.__sharedPluginEntrypointCalls).toEqual([context, 'stop']);
});

test('does not advertise a settings panel when the plugin has none', () => {
	for (const code of [
		'({default:{start(){},stop(){}}})',
		'({start(){},stop(){}})',
		'({default:{getSettingsPanel(){return "panel";}}})',
	]) {
		const chunk = { code, type: 'chunk' };
		const bundle = hermesExpressionEntrypoint();
		bundle.generateBundle({}, { entry: chunk });
		const entry = Function(`return ${chunk.code}`)();

		expect(entry.getSettingsPanel).toBeUndefined();
	}
});

test('does not evaluate a plugin merely to check whether it has settings', () => {
	globalThis.__sharedPluginEntrypointCalls = [];
	const chunk = {
		code: '(()=>{globalThis.__sharedPluginEntrypointCalls.push("loaded");return {default:{start(){}}};})()',
		type: 'chunk',
	};
	const bundle = hermesExpressionEntrypoint();
	bundle.generateBundle({}, { entry: chunk });
	const entry = Function(`return ${chunk.code}`)();

	expect(entry.getSettingsPanel).toBeUndefined();
	expect(globalThis.__sharedPluginEntrypointCalls).toEqual([]);
});
