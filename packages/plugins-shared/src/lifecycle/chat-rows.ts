import type { PluginSelfTestResult } from '@unbound-app/api/global';
import { metro, patcher } from '@unbound-app/api';

import { duplicatedMessages, type ChatRow } from './duplicated-messages';

let lastRows: readonly ChatRow[] | undefined;

/**
 * @description Remembers the rows Discord's `ChatManager` last built for the open chat, through `getPreviousRows`, so
 * {@link chatRowsSelfTest} can check them. The plugin's patcher removes the patch when it stops.
 */
export function trackChatRows(): void {
	lastRows = undefined;
	metro.onModuleLoaded(metro.filters.byName('ChatManager'), (ChatManager) => {
		const prototype = (ChatManager as { prototype?: object } | undefined)?.prototype;

		if (!prototype || !('getPreviousRows' in prototype)) return;

		patcher.after(
			prototype as { getPreviousRows: () => unknown },
			'getPreviousRows',
			({ result }) => {
				if (Array.isArray(result)) lastRows = result as ChatRow[];
			},
		);
	});
}

/**
 * @description Builds a self-test, for plugins that change how Discord rebuilds chat rows, that fails when the open
 * chat shows a message twice, as Discord 353's changed rebuild did with Client Side Block.
 * @returns `ok` when no message repeats, or when no chat was built since the plugin started.
 */
export function chatRowsSelfTest(): PluginSelfTestResult {
	if (!lastRows) return { ok: true, detail: 'no chat rows built yet' };

	const duplicated = duplicatedMessages(lastRows);

	return duplicated.length
		? {
				ok: false,
				detail: `${duplicated.length} messages shown twice, such as ${duplicated[0]}`,
			}
		: { ok: true, detail: `${lastRows.length} chat rows, none repeated` };
}

export default chatRowsSelfTest;
