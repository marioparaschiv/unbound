import { toasts } from '@unbound-app/api';

import { actionLabel, applyAction, type EmbedAction } from '~/embeds';
import { PLUGIN_NAME } from '~/constants';
import { REST } from '~/modules';

// UNKNOWN: Discord's REST client rejects with an untyped error.
function errorText(error: unknown): string {
	const body = (error as { body?: { message?: unknown } } | undefined)?.body;

	if (typeof body?.message === 'string') return body.message;

	return error instanceof Error ? error.message : 'Discord refused the change.';
}

/**
 * @description Sets or clears a message's suppress-embeds flag with `PATCH /channels/{channel}/messages/{message}` through Discord's REST client. Discord's gateway update then redraws the message.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @param flags The message's current flags.
 * @param action The change to make.
 * @returns A promise that settles once the request finishes. A failure is shown in a toast.
 */
export async function changeEmbeds(
	channelId: string,
	messageId: string,
	flags: number | undefined,
	action: EmbedAction,
): Promise<void> {
	try {
		await REST.patch({
			url: `/channels/${channelId}/messages/${messageId}`,
			body: { flags: applyAction(flags, action) },
		});
	} catch (error) {
		toasts.show({
			title: PLUGIN_NAME,
			content: `${actionLabel(action)} failed: ${errorText(error)}`,
		});
	}
}

export default changeEmbeds;
