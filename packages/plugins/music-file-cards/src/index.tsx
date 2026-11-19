import { Image } from 'react-native';
import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { findElement } from '@unbound-plugins/shared/react/find-element';
import { assets, dialogs, metro, patcher, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { audioAttachment, type Attachment } from '~/lib/audio-attachments';
import { readTags, type Cover } from '~/lib/tags';
import { base64 } from '~/lib/text';

type SheetProps = { message?: { attachments?: Attachment[] } };

const HEAD_BYTES = 512 * 1024;
const COVER_SIZE = 220;

function coverView(cover: Cover) {
	const uri = `data:${cover.mime};base64,${base64(cover.bytes)}`;

	return function CoverArt() {
		return (
			<Image
				source={{ uri }}
				style={{
					width: COVER_SIZE,
					height: COVER_SIZE,
					borderRadius: 12,
					alignSelf: 'center',
				}}
			/>
		);
	};
}

async function showSong({ url = '', filename = '' }: Attachment) {
	try {
		const response = await fetch(url, { headers: { Range: `bytes=0-${HEAD_BYTES - 1}` } });
		const buffer = await response.arrayBuffer();
		const tags = readTags(new Uint8Array(buffer.slice(0, HEAD_BYTES)));

		if (!tags.title && !tags.artist && !tags.album && !tags.cover) {
			toasts.show({ id: 'music-file-cards', title: messages.NO_TAGS });

			return;
		}

		dialogs.showDialog({
			title: tags.title || filename,
			body: [
				tags.artist ? format('BY_ARTIST', { artist: tags.artist }) : '',
				tags.album ? format('ON_ALBUM', { album: tags.album }) : '',
			]
				.join('')
				.trim(),
			...(tags.cover ? { content: coverView(tags.cover) } : {}),
			cancel: messages.CLOSE,
		});
	} catch (error) {
		toasts.show({
			id: 'music-file-cards',
			title: messages.LOAD_FAILED,
			content: String(error),
		});
	}
}

export function start() {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Music File Cards skipped: Discord moved ActionSheets.');

		return;
	}

	let song: Attachment | undefined;
	let sheetKey: string | undefined;

	// UNKNOWN: an action sheet may render any node.
	function addSongRow(result: unknown) {
		const rows = findElement(result, isActionSheetRowGroup)?.props?.children;
		const attachment = song;

		if (
			!attachment ||
			!Array.isArray(rows) ||
			rows.some((row) => row?.key === 'unbound-song')
		) {
			return result;
		}

		const ActionSheetRow = getActionSheetRow();
		const icon = assets.getIdByName('MusicIcon');

		rows.splice(
			1,
			0,
			<ActionSheetRow
				key='unbound-song'
				label={messages.SHOW_SONG}
				icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
				onPress={() => {
					if (sheetKey) ActionSheets.hideActionSheet(sheetKey);

					void showSong(attachment);
				}}
			/>,
		);

		return result;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (!key.endsWith('MessageLongPressActionSheet')) return;

		song = audioAttachment(props.message?.attachments);
		sheetKey = key;

		return addSongRow;
	});
}

export function stop() {}
