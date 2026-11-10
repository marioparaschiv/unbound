import { drawnSelfTest, type SelfTestResult } from '@unbound-plugins/shared/lifecycle/features';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import {
	MessageStore,
	RoleStore,
	RowGenerator,
	SelectedChannelStore,
	settings,
	UserStore,
} from '~/avatars/modules';
import { subscribeMentionSources } from '~/avatars/events/mention-sources';
import { patchRowGenerator } from '~/avatars/patches/row-generator';
import { createMentionIndex } from '~/avatars/mention-index';
import { startRenderer } from '~/avatars/platform';

let renderer: ReturnType<typeof startRenderer> | undefined;

/**
 * @description Draws avatars and role icons inside mentions, from the mentions each chat row carries.
 * Patches `generateMessageRowData` on Discord's row generator module and reads users, messages, the selected channel and,
 * when it loads, roles from `UserStore`, `MessageStore`, `SelectedChannelStore` and `RoleStore`. The native renderer
 * (`ios/`, `android/`) rewrites the message text views.
 * @param context The plugin's start context, with its native bridge and Capabilities.
 * @returns A function that restores every rewritten text view and removes the native hooks, which the Addon scope can't see.
 */
export function startAvatars(context: PluginContext): (() => void) | undefined {
	const modules = { MessageStore, SelectedChannelStore, UserStore, RowGenerator };

	if (!ensureCapabilities(context.native, context.capabilities) || !ensureModules(modules)) {
		return;
	}

	const index = createMentionIndex(ensureModules({ RoleStore }, 'role mentions'));

	patchRowGenerator(index);
	renderer = startRenderer(context.native, index, () => settings.get('showAtSymbol', true));
	subscribeMentionSources(renderer.retryWaiting);

	return () => {
		void renderer?.dispose();
		renderer = undefined;
	};
}

/**
 * @description Reports whether the mentions on screen drew their images.
 * @param features The features' own self-test result.
 * @returns The self-test result for the plugin's `selfTest` export.
 */
export function avatarsSelfTest(features: SelfTestResult): SelfTestResult {
	const missing = renderer?.failed() ?? [];

	if (missing.length) {
		return { ok: false, detail: `${missing.length} mention avatars failed to load` };
	}

	return drawnSelfTest(features, renderer?.rendered, 'mention avatars', renderer?.settling);
}
