import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import hookMessageCells from '@unbound-plugins/shared/native/ios/message-cell-hooks';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { drawnSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { createAndroidRenderer } from '~/android/renderer';
import { createVisibleCellScanner } from '~/ios/visible-cells';
import { subscribeSelectedChannel } from '~/events/selected-channel';
import { subscribeMentionSources } from '~/events/mention-sources';
import { patchRowGenerator } from '~/patches/row-generator';
import { createRenderer } from '~/ios/renderer';
import { createMentionIndex } from '~/mention-index';
import {
	MessageStore,
	RoleStore,
	RowGenerator,
	SelectedChannelStore,
	settings,
	UserStore,
} from '~/modules';

let dispose = () => {};
let rendered: (() => number) | undefined;
let failed: (() => string[]) | undefined;

function start(context: PluginContext) {
	const { objc } = context.native;
	const modules = {
		MessageStore,
		SelectedChannelStore,
		UserStore,
		generateMessageRowData: RowGenerator.generateMessageRowData,
	};

	if (
		!ensureCapabilities('Mention Avatars', context.native, context.capabilities) ||
		!ensureModules('Mention Avatars', modules)
	) {
		return;
	}

	const index = createMentionIndex(
		ensureModules('Mention Avatars: role mentions', { RoleStore }),
	);
	const showAtSymbol = () => settings.get('showAtSymbol', true);

	if (context.platform === 'android') {
		const android = createAndroidRenderer(context.native, index, showAtSymbol);

		rendered = android.rendered;
		failed = android.failed;
		dispose = applyFeatures('Mention Avatars', [
			() => android.dispose,
			() => patchRowGenerator(index),
			() => subscribeMentionSources(android.retryWaiting),
		]);

		return;
	}

	const renderer = createRenderer(objc, index, showAtSymbol);
	const scanner = createVisibleCellScanner(objc, renderer.schedule);

	rendered = renderer.rendered;
	failed = renderer.failed;

	dispose = applyFeatures('Mention Avatars', [
		() => renderer.dispose,
		() => patchRowGenerator(index),
		() =>
			hookMessageCells(objc, {
				shown: renderer.schedule,
				laidOut: renderer.schedule,
				reused: renderer.reuse,
				textChanged: renderer.schedule,
			}),
		() => subscribeSelectedChannel(renderer, scanner),
		() => subscribeMentionSources(renderer.retryWaiting),
	]);
}

function stop() {
	dispose();
	dispose = () => {};
	rendered = undefined;
	failed = undefined;
}

function selfTest() {
	const missing = failed?.() ?? [];

	if (missing.length) {
		return { ok: false, detail: `${missing.length} mention avatars failed to load` };
	}

	return drawnSelfTest(rendered, 'mention avatars');
}

export default {
	start,
	stop,
	selfTest,
};
