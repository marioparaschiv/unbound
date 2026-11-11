import { drawnSelfTest } from '@unbound-plugins/shared/lifecycle/drawn-self-test';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginSelfTestResult } from '@unbound-app/api/global';
import type { PluginContext } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';
import { metro, native } from '@unbound-app/api';

import { drawMentions as android } from '~/native/views-android';
import { drawMentions as ios } from '~/native/views-ios';
import { listenToMentionSources } from '~/flux/listeners';
import { createMentionIndex } from '~/lib/mention-index';
import { RoleStore } from '~/lib/modules';
import { patchMessageRows } from '~/patches';

const drawMentions = native.definePlatform({ ios, android });

let drawn: ReturnType<typeof drawMentions> | undefined;

/**
 * @description Draws avatars and role icons inside mentions, from the mentions each chat row carries.
 * Patches `generateMessageRowData` on Discord's message row module and reads users, messages, the selected channel and,
 * when it loads, roles from `UserStore`, `MessageStore`, `SelectedChannelStore` and `RoleStore`. The native renderer
 * (`*-ios.ts`, `*-android.ts`) rewrites the message text views until {@link restoreMentionText}.
 * @param context The plugin's start context, with its native bridge and Capabilities.
 */
export function drawMentionAvatars(context: PluginContext): void {
	if (!ensureCapabilities(context.native, context.capabilities, 'Mention avatars')) return;

	if (!metro.findByProps('generateMessageRowData')) {
		logger.warn('Mention avatars skipped: Discord moved MessageRowData.');

		return;
	}

	if (!RoleStore) {
		logger.warn('Role mentions skipped: Discord moved RoleStore.');
	}

	const index = createMentionIndex(Boolean(RoleStore));

	patchMessageRows(index);
	drawn = drawMentions(context.native, index, () => settings.showAtSymbol);
	listenToMentionSources(drawn.retryWaiting);
}

/**
 * @description Restores every rewritten text view, which the plugin scope cannot see. Call it after `patcher.unpatchAll()`.
 */
export function restoreMentionText(): void {
	drawn?.dispose();
	drawn = undefined;
}

/**
 * @description Reports whether the mentions on screen drew their images.
 * @returns The self-test result for the plugin's `selfTest` export.
 */
export function selfTest(): PluginSelfTestResult {
	const missing = drawn?.failed() ?? [];

	if (missing.length) {
		return { ok: false, detail: `${missing.length} mention avatars failed to load` };
	}

	return drawnSelfTest(drawn?.rendered, 'mention avatars', drawn?.settling);
}
