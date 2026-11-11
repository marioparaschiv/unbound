import { onMessageRow } from '@unbound-plugins/shared/metro/message-rows';

import type { MentionIndex } from '~/avatars/mention-index';
import type { Message } from '~/avatars/resolve-mentions';

/**
 * @description Indexes each message's mentions as Discord builds its chat row.
 * @param index The mention index to fill.
 * The Addon scope removes the patch when the plugin stops.
 */
export function patchRowGenerator(index: MentionIndex): void {
	onMessageRow<Message>({ after: ({ message }) => index.add(message) });
}
