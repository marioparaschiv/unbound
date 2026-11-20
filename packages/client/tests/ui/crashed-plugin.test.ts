import { describe, expect, mock, test } from 'bun:test';

mock.module('~/plugins/api', () => ({
	getAll: () => [
		{ id: 'unbound.message-latency', name: 'Message Latency' },
		{ id: 'someone.cool-plugin', name: 'Cool Plugin' },
	],
}));

const { crashedPluginName } = await import('~/ui/crashed-plugin');

function errorWithStack(stack: string): Error {
	const error = new Error('boom');

	error.stack = stack;

	return error;
}

describe('crashedPluginName', () => {
	test("names the plugin whose bundle the error's stack runs through", () => {
		const error = errorWithStack(
			'TypeError: boom\n    at render (unbound-plugin/unbound.message-latency.js:1:20)',
		);

		expect(crashedPluginName(error)).toBe('Message Latency');
	});

	test('reads the component stack too', () => {
		expect(
			crashedPluginName(
				new Error('boom'),
				'\n    in Row (unbound-plugin/someone.cool-plugin.js:3:1)',
			),
		).toBe('Cool Plugin');
	});

	test('names no plugin for errors in Discord itself', () => {
		expect(
			crashedPluginName(
				errorWithStack('TypeError: boom\n    at Messages (main.jsbundle:1:5)'),
			),
		).toBeUndefined();
	});
});
