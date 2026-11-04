import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import { drawnSelfTest } from '@unbound-plugins/shared/lifecycle/health';
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
	type Embeds,
} from '~/embeds/modules';
import { emptyEmbeds } from '~/embeds/components/message-surface';
import { startMediaPatches } from '~/embeds/patches/media';
import { startEmbeds } from '~/embeds/platform';

/**
 * @description Draws the message a Discord message link points at as a chat row under the message that links it, and lets GIFs, animated emoji, stickers and Lottie animations play inside it.
 * Depends on `MessageStore`, `ChannelStore`, `SelectedChannelStore`, the `Messages` actions, and Discord's `MessageRecord`, `RowManager` and `ChatItem` renderers.
 * On iOS it hooks `DCDMessageTableViewCell`; on Android it rewrites the message text views. Patches the render of `FastImage` and swaps `LottieAnimationView` and `NativeLottieView`, which can be classes.
 * @param context The plugin's start context, with its native bridge and capabilities.
 * @returns The embeds, whose `dispose` the plugin's `stop` returns, or `undefined` when the plugin cannot run here.
 */
export function startMessageLinkEmbeds(context: PluginContext): Embeds | undefined {
	// `ChatItem` has a fallback search, so it is checked when an embed renders.
	const modules = {
		ChannelStore,
		MessageStore,
		SelectedChannelStore,
		MessageActions,
		MessageRecord,
		RowManager,
	};

	if (
		!ensureCapabilities('Message Link Embeds', context.native, context.capabilities) ||
		!ensureModules('Message Link Embeds', modules)
	) {
		return;
	}

	const embeds = startEmbeds(context.native, renderers);

	if (!embeds) return;

	return {
		drawn: embeds.drawn,
		dispose: applyFeatures('Message Link Embeds', [() => embeds.dispose, startMediaPatches]),
	};
}

/**
 * @description Checks that every embed drew something.
 * @param embeds The running embeds.
 * @returns The self-test result.
 */
export function selfTestEmbeds(embeds: Embeds | undefined) {
	const empty = emptyEmbeds();

	if (empty.length) return { ok: false, detail: `${empty.length} embeds stayed empty` };

	return drawnSelfTest(embeds?.drawn, 'embeds');
}
