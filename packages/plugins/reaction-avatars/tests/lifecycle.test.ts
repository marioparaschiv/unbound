import {
	flux,
	logs,
	metro,
	native,
	pluginHolds,
	startPlugin,
	stopPlugin,
} from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import type { NativePluginBridge, NativeUIScope } from '@unbound-app/api/native';

// The kit has no UI scope: the scope runs a worklet on this thread against the fake bridges.
const ui = {
	createScope: () => ({ objc: native.objc.bridge, dispose: () => {} }),
	run: (
		worklet: (scope: NativeUIScope, ...args: string[]) => void,
		scope: NativeUIScope,
		...args: string[]
	) => worklet(scope, ...args),
};
const overrides = { native: { ui } as unknown as NativePluginBridge };

beforeEach(() => {
	native.objc.registerClass('DCDMessageTableViewCell', {
		methods: {
			didMoveToWindow: () => null,
			prepareForReuse: () => null,
			layoutSubviews: () => null,
			'sizeThatFits:': () => null,
		},
	});
	metro.register(
		{ addReaction: () => undefined },
		'modules/reactions/ReactionActionCreators.tsx',
	);
	flux.seed({
		Channel: {},
		Message: {},
		SelectedChannel: { getChannelId: () => '1' },
		User: {},
	});
});

describe('starting and stopping', () => {
	test('leaves nothing behind once the plugin stopped', async () => {
		await startPlugin(overrides);

		expect(pluginHolds()).toContain('timer');
		// `stopPlugin` rejects when the scope still holds anything after `stop`.
		await expect(stopPlugin()).resolves.toBeUndefined();
	});

	test('starts without a warning, so the self test passes', async () => {
		await startPlugin(overrides);

		expect(logs.entries.filter((entry) => entry.level === 'warn')).toEqual([]);

		await stopPlugin();
	});
});
