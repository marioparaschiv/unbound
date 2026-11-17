import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { format, messages } from '@unbound-app/i18n';
import { flux, metro, patcher, toasts } from '@unbound-app/api';

import {
	commandId,
	commandMention,
	invokedCommand,
	type IndexedCommand,
	type InvokedCommand,
} from '~/lib/mentions';

type SheetMessage = Parameters<typeof invokedCommand>[0] & { channel_id?: string };

type SheetProps = { message?: SheetMessage };

type CommandIndex = { application_commands?: IndexedCommand[] };

type REST = { get(request: { url: string }): Promise<{ body?: CommandIndex }> };

type Channel = { guild_id?: string | null };

function indexUrls(channelId: string): string[] {
	const channel = flux.getStore('Channel').getChannel(channelId) as Channel | undefined;
	const scoped = channel?.guild_id
		? `/guilds/${channel.guild_id}/application-command-index`
		: `/channels/${channelId}/application-command-index`;

	return [scoped, '/users/@me/application-command-index'];
}

async function findCommandId(
	channelId: string,
	command: InvokedCommand,
): Promise<string | undefined> {
	for (const url of indexUrls(channelId)) {
		const response = await (metro.common.REST as REST).get({ url });
		const id = commandId(response.body?.application_commands ?? [], command);

		if (id) return id;
	}

	return undefined;
}

async function copyMention(channelId: string, command: InvokedCommand): Promise<void> {
	try {
		const id = await findCommandId(channelId, command);

		if (!id) {
			toasts.show({
				title: addon.name,
				content: format('NOT_FOUND', { name: command.name }),
			});

			return;
		}

		const mention = commandMention(command, id);

		metro.common.Clipboard.setString(mention);
		toasts.show({ title: addon.name, content: format('COPIED', { mention }) });
	} catch (error) {
		logger.error(`Failed to find command /${command.name} in channel ${channelId}:`, error);
		toasts.show({ title: addon.name, content: format('NOT_FOUND', { name: command.name }) });
	}
}

/**
 * @description Adds Copy Command Mention to the long-press sheet of a bot reply that a slash command produced. The
 * command id comes from the guild's or DM's command index, then from your user-installed apps.
 */
export function patchActionSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Command mentions skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const command = invokedCommand(props.message);
		const channelId = props.message?.channel_id;

		if (!key.endsWith('MessageLongPressActionSheet') || !command || !channelId) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-copy-command-mention',
					label: messages.COPY_MENTION,
					icon: 'SlashBoxIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						void copyMention(channelId, command);
					},
				},
			]);

			return result;
		};
	});
}
