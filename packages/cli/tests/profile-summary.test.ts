import { describe, expect, test } from 'bun:test';

import { chromeTraceSchema, formatProfile, summarizeProfile } from '~/lib/profile-summary';

const trace = chromeTraceSchema.parse({
	stackFrames: {
		'1': { name: 'render(unbound-plugin:chat-bubbles:1:20)', category: 'JavaScript' },
		'2': {
			name: 'measure(unbound-plugin:chat-bubbles:1:90)',
			category: 'JavaScript',
			parent: 1,
		},
		'3': { name: '[Native]', category: 'Native', parent: 2 },
		'4': { name: 'flush(address at unbound:4:10)', category: 'JavaScript' },
		'5': { name: '[Idle]', category: 'Native' },
	},
	samples: [{ sf: 3 }, { sf: 2 }, { sf: 1 }, { sf: '4' }, { sf: 5 }],
});

describe('summarizeProfile', () => {
	test('ranks functions and sources by the samples they ran in', () => {
		const summary = summarizeProfile(trace, 10);

		expect(summary.samples).toBe(5);
		expect(summary.javaScriptSamples).toBe(4);
		expect(summary.functions).toEqual([
			{ name: 'measure(unbound-plugin:chat-bubbles:1:90)', self: 2, total: 2 },
			{ name: 'render(unbound-plugin:chat-bubbles:1:20)', self: 1, total: 3 },
			{ name: 'flush(address at unbound:4:10)', self: 1, total: 1 },
		]);
		expect(summary.sources).toEqual([
			{ name: 'unbound-plugin:chat-bubbles', self: 3, total: 3 },
			{ name: 'address at unbound', self: 1, total: 1 },
		]);
	});

	test('says when the JavaScript thread sat idle', () => {
		const idle = chromeTraceSchema.parse({ stackFrames: {}, samples: [{ sf: 9 }] });

		expect(formatProfile(summarizeProfile(idle, 10))).toContain('was idle');
	});
});
