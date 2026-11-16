import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { format, messages } from '@unbound-app/i18n';
import { metro, patcher, toasts } from '@unbound-app/api';

import { addFollowUp, isFollowedUp, removeFollowUp, snippetOf } from '~/lib/follow-ups';
import { getFollowUps, saveFollowUps } from '~/lib/store';
import { openFollowUps } from '~/lib/sheet';

type SheetMessage = {
	id?: string;
	channel_id?: string;
	content?: string;
	author?: { globalName?: string | null; username?: string };
};

type SheetProps = { message?: SheetMessage; channel?: { guild_id?: string | null } };

function toggle(
	message: Required<Pick<SheetMessage, 'id' | 'channel_id'>> & SheetMessage,
	guildId: string | null,
) {
	const list = getFollowUps();

	if (isFollowedUp(list, message.id)) {
		saveFollowUps(removeFollowUp(list, message.id));
		toasts.success('DONE');

		return;
	}

	saveFollowUps(
		addFollowUp(list, {
			channelId: message.channel_id,
			messageId: message.id,
			guildId,
			author: message.author?.globalName || message.author?.username || '?',
			snippet: snippetOf(message.content ?? ''),
			addedAt: Date.now(),
		}),
	);
	toasts.success('ADDED');
}

/**
 * @description Adds Follow Up Later (or Mark Follow-Up Done) and a row opening the follow-ups to the message
 * long-press action sheet.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Follow-up rows skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const message = props.message;

		if (!key.endsWith('MessageLongPressActionSheet') || !message?.id || !message.channel_id) {
			return;
		}

		const target = { ...message, id: message.id, channel_id: message.channel_id };
		const guildId = props.channel?.guild_id ?? null;

		return (result) => {
			const list = getFollowUps();
			const followed = isFollowedUp(list, target.id);

			insertSheetRows(result, [
				{
					key: 'unbound-follow-up',
					label: followed ? messages.REMOVE : messages.ADD,
					icon: followed ? 'CheckmarkLargeIcon' : 'ChatDotsIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						toggle(target, guildId);
					},
				},
				...(list.length
					? [
							{
								key: 'unbound-follow-up-open',
								label: format('OPEN', { count: list.length }),
								icon: 'ListBulletsIcon',
								onPress: () => {
									ActionSheets.hideActionSheet(key);
									openFollowUps();
								},
							},
						]
					: []),
			]);

			return result;
		};
	});
}

export default { patchActionSheets };
