import { drawnSelfTest } from '@unbound-plugins/shared/lifecycle/drawn-self-test';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginContext } from '@unbound-app/api/native';
import type { PluginSelfTestResult } from '@unbound-app/api/global';
import { native } from '@unbound-app/api';

import { MessageActions, MessageRecord, renderers, RowManager } from '~/lib/modules';
import { emptyEmbeds } from '~/components/message-surface';
import { drawAndroidEmbeds as android } from '~/native/embeds-android';
import { drawIOSEmbeds as ios } from '~/native/embeds-ios';

const drawPlatformEmbeds = native.definePlatform({ ios, android });

let embeds: ReturnType<typeof drawPlatformEmbeds> | undefined;

/**
 * @description Draws the message a Discord message link points at as a chat row under the message that links it.
 * On iOS it hooks `DCDMessageTableViewCell`; on Android it rewrites the message text views. `ChatItem` has a fallback search, so it is checked when an embed renders.
 * @param context The plugin's start context, with its native bridge and capabilities.
 */
export function drawEmbeds(context: PluginContext): void {
	if (!ensureCapabilities(context.native, context.capabilities, 'Embeds')) return;

	if (!MessageActions || !MessageRecord || !RowManager) {
		logger.warn(
			'Embeds skipped: Discord moved the Messages actions, MessageRecord or RowManager.',
		);
		return;
	}

	embeds = drawPlatformEmbeds(context.native, renderers);
}

/**
 * @description Removes every embed and lets go of the messages they hold.
 * @returns A promise that settles once the native surfaces are gone.
 */
export async function eraseEmbeds(): Promise<void> {
	const current = embeds;

	embeds = undefined;
	await current?.dispose();
}

/**
 * @description Checks that every embed drew something.
 * @returns The self-test result.
 */
export function selfTestEmbeds(): PluginSelfTestResult {
	const empty = emptyEmbeds();

	if (empty.length) return { ok: false, detail: `${empty.length} embeds stayed empty` };

	return drawnSelfTest(embeds?.drawn, 'embeds');
}
