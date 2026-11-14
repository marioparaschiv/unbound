import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { flux, metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { ACTIONS, targetsOf, VOICE_TYPES } from '~/lib/actions';
import { canIn, channelOf, voiceStatesOf } from '~/lib/members';
import { openMoveSheet } from '~/components/move-sheet';
import { runOnEveryone } from '~/lib/run';

type SheetProps = { channelId?: unknown; channel?: { id?: unknown } | null };

const CHANNEL_SHEETS = /^(?:Channel(?:LongPress)?ActionSheet)(?::|$)/i;

let open: { key: string; channelId: string } | null = null;

function sheetChannelId(key: string, props: SheetProps | undefined): string | undefined {
	if (!CHANNEL_SHEETS.test(key)) return undefined;

	const id = props?.channel?.id ?? props?.channelId;

	return typeof id === 'string' ? id : undefined;
}

function currentUserId(): string {
	return (
		(
			flux.getStore('User') as unknown as { getCurrentUser(): { id?: string } | undefined }
		).getCurrentUser()?.id ?? ''
	);
}

/**
 * @description Adds rows that disconnect, mute, deafen or move everyone in a voice channel to the channel's long-press
 * sheet, each only while someone besides you is in it and you hold the permission. Patches the sheets Discord opens
 * through `openLazy` on its action sheets module.
 */
export function patchChannelSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Voice chat utils skipped: Discord moved ActionSheets.');

		return;
	}

	const renderer = createSheetRenderer(patcher, (result) => {
		const channel = open ? channelOf(open.channelId) : undefined;
		const key = open?.key;
		const me = currentUserId();

		if (!channel || !key || !VOICE_TYPES.has(channel.type ?? -1)) return;
		if (!targetsOf(voiceStatesOf(channel.id), me).length) return;

		const close = () => {
			ActionSheets.hideActionSheet(key);
			ActionSheets.hideAllActionSheets?.();
		};
		const rows = ACTIONS.filter((action) => canIn(action.permission, channel)).map(
			(action) => ({
				key: `unbound-voice-chat-utils-${action.key}`,
				label: messages[action.label as keyof typeof messages],
				icon: action.icon,
				onPress: () => {
					close();
					void runOnEveryone(channel, action.label, action.body, me);
				},
			}),
		);

		if (canIn('MOVE_MEMBERS', channel)) {
			rows.push({
				key: 'unbound-voice-chat-utils-move',
				label: messages.MOVE_ALL,
				icon: 'ArrowsLeftRightIcon',
				onPress: () => {
					close();
					openMoveSheet(channel, me);
				},
			});
		}

		insertSheetRows(result, rows);
	});

	patchLazySheets(patcher, ActionSheets, (key, props) => {
		const channelId = sheetChannelId(key, props as SheetProps);

		open = channelId ? { key, channelId } : null;

		return open ? renderer.render : undefined;
	});
}
