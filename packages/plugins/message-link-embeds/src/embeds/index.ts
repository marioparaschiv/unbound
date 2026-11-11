import {
	drawnSelfTest,
	type Feature,
	type SelfTestResult,
} from '@unbound-plugins/shared/lifecycle/features';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import {
	ChannelStore,
	MessageActions,
	MessageRecord,
	MessageStore,
	renderers,
	RowManager,
	SelectedChannelStore,
} from '~/embeds/modules';
import { emptyEmbeds } from '~/embeds/components/message-surface';
import { startMediaPatches } from '~/embeds/patches/media';
import { startEmbeds } from '~/embeds/platform';

let drawn: (() => number) | undefined;

/**
 * @description Draws the message a Discord message link points at as a chat row under the message that links it, and lets GIFs, animated emoji, stickers and Lottie animations play inside it.
 * Depends on `MessageStore`, `ChannelStore`, `SelectedChannelStore`, the `Messages` actions, and Discord's `MessageRecord`, `RowManager` and `ChatItem` renderers.
 * On iOS it hooks `DCDMessageTableViewCell`; on Android it rewrites the message text views. Patches the render of `FastImage` and swaps `LottieAnimationView` and `NativeLottieView`, which can be classes.
 * @param context The plugin's start context, with its native bridge and capabilities.
 * @returns The embeds' dispose and the media patches, which start together, or `undefined` when the plugin cannot run here.
 */
export function embedFeatures(context: PluginContext): Feature[] | undefined {
	// `ChatItem` has a fallback search, so it is checked when an embed renders.
	const modules = {
		ChannelStore,
		MessageStore,
		SelectedChannelStore,
		MessageActions,
		MessageRecord,
		RowManager,
	};

	if (!ensureCapabilities(context.native, context.capabilities) || !ensureModules(modules)) {
		return;
	}

	const embeds = startEmbeds(context.native, renderers);

	if (!embeds) return;

	drawn = embeds.drawn;

	return [
		() => () => {
			drawn = undefined;

			return embeds.dispose();
		},
		startMediaPatches,
	];
}

/**
 * @description Checks that every embed drew something.
 * @param features The features' own self-test result.
 * @returns The self-test result.
 */
export function selfTestEmbeds(features: SelfTestResult): SelfTestResult {
	const empty = emptyEmbeds();

	if (empty.length) return { ok: false, detail: `${empty.length} embeds stayed empty` };

	return drawnSelfTest(features, drawn, 'embeds');
}
