import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import ensureClasses from '@unbound-plugins/shared/native/ensure-classes';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';
import { messageTextViewClass } from '@unbound-plugins/shared/native/text-attachments';

import {
	ChannelStore,
	FastImageSource,
	LottieAnimationViewSource,
	MessageActions,
	MessageRecord,
	MessageStore,
	NativeLottieViewSource,
	renderers,
	RowManager,
	SelectedChannelStore,
} from '~/modules';
import { patchLottieAnimationView } from '~/patches/lottie-animation-view';
import { patchNativeLottieView } from '~/patches/native-lottie-view';
import { subscribeMessageStore } from '~/native/message-sync';
import { createAndroidEmbeds } from '~/android/embeds';
import { createNativeEmbeds } from '~/android/native-embeds';
import { patchFastImage } from '~/patches/fast-image';
import { hookMessageCells } from '~/native/cells';
import { createSession } from '~/native/session';

let dispose: () => Promise<void> | undefined = () => undefined;

function start(context: PluginContext) {
	const { objc, fabric } = context.native;
	// `ChatItem` has a fallback search, so it is checked when an embed renders.
	const modules = {
		ChannelStore,
		MessageStore,
		SelectedChannelStore,
		MessageActions,
		MessageRecord,
		RowManager,
	};

	if (context.platform === 'android') {
		if (
			!ensureCapabilities('Message Link Embeds', context.native, context.capabilities) ||
			!ensureModules('Message Link Embeds', modules)
		) {
			return;
		}

		const android =
			createNativeEmbeds(context.native, renderers) ??
			createAndroidEmbeds(context.native, renderers);

		if (!android) {
			console.error('[Message Link Embeds] Skipped, the embed surface did not register.');

			return;
		}

		dispose = applyFeatures('Message Link Embeds', [
			() => android.dispose,
			() => whenLoaded(FastImageSource, patchFastImage),
			() => whenLoaded(LottieAnimationViewSource, patchLottieAnimationView),
			() => whenLoaded(NativeLottieViewSource, patchNativeLottieView),
		]);

		return;
	}

	if (
		!ensureCapabilities('Message Link Embeds', context.native, context.capabilities) ||
		!ensureModules('Message Link Embeds', modules) ||
		!ensureClasses('Message Link Embeds', objc, [
			'DCDMessageTableViewCell',
			messageTextViewClass(objc),
		])
	) {
		return;
	}

	const embeds = createSession(objc, fabric, renderers);

	if (!embeds) {
		console.error('[Message Link Embeds] Skipped, the embed surface did not register.');

		return;
	}

	const { session } = embeds;

	dispose = applyFeatures('Message Link Embeds', [
		() => embeds.dispose,
		() => whenLoaded(FastImageSource, patchFastImage),
		() => whenLoaded(LottieAnimationViewSource, patchLottieAnimationView),
		() => whenLoaded(NativeLottieViewSource, patchNativeLottieView),
		() => subscribeMessageStore(session),
		() => hookMessageCells(session),
	]);
}

function stop() {
	const finished = dispose();

	dispose = () => undefined;

	return finished;
}

export default { start, stop };
