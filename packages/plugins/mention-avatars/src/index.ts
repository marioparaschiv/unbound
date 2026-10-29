import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import hookMessageCells from '@unbound-plugins/shared/native/message-cell-hooks';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { createAndroidRenderer } from '~/android/renderer';
import { createVisibleCellScanner } from '~/native/visible-cells';
import { subscribeSelectedChannel } from '~/events/selected-channel';
import { patchRowGenerator } from '~/patches/row-generator';
import { createRenderer } from '~/native/renderer';
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

function start(context: PluginContext) {
	const { objc } = context.native;
	const modules = {
		MessageStore,
		SelectedChannelStore,
		UserStore,
		RowGenerator,
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

		dispose = applyFeatures('Mention Avatars', [
			() => android.dispose,
			() => patchRowGenerator(index),
		]);

		return;
	}

	const renderer = createRenderer(objc, index, showAtSymbol);
	const scanner = createVisibleCellScanner(objc, renderer.schedule);

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
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop };
