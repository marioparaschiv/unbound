import { flux, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

// The bridge is hand-built: the kit has no objc fake yet. It sees no windows, so no cell is ever drawn.
function createBridge(onScopeDispose: () => void) {
	const calls: string[] = [];
	const removed: string[] = [];

	const objc = {
		getClass: (name: string) => name,
		call: () => 'clear',
		alloc: () => ({}),
		array: () => [],
		struct: () => ({}),
		invokeAsync: async () => null,
		findViews: async () => [],
		batch: async () => {
			calls.push('batch');

			return [null, [], null];
		},
		hook: (className: string, selector: string) => {
			calls.push(`hook ${className} ${selector}`);

			return { remove: () => removed.push(`${className} ${selector}`) };
		},
	};
	const ui = {
		createScope: () => ({ dispose: onScopeDispose }),
		run: () => {},
		callback: (fn: unknown) => fn,
	};

	return { objc, ui, calls, removed };
}

beforeEach(() => {
	flux.seed({ Theme: { theme: 'dark' } });
});

describe('stopping the bubbles', () => {
	test('removes every native hook it installed', async () => {
		const bridge = createBridge(() => {});

		await startPlugin({ native: bridge as never });
		expect(bridge.calls.filter((call) => call.startsWith('hook'))).not.toHaveLength(0);

		await stopPlugin();

		expect(bridge.removed).toHaveLength(
			bridge.calls.filter((call) => call.startsWith('hook')).length,
		);
	});

	test('does not repaint when the theme changes while the bubbles are being removed', async () => {
		let repaint = () => {};
		const bridge = createBridge(() => repaint());

		repaint = () => flux.emit('Theme');
		await startPlugin({ native: bridge as never });

		const before = bridge.calls.filter((call) => call === 'batch').length;

		await stopPlugin();

		expect(bridge.calls.filter((call) => call === 'batch')).toHaveLength(before);
	});
});
