import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';
import { useState } from 'react';

import { fetchPack, packId, stickerUrl, type Pack, type Sticker } from '~/lib/line';
import { removePack, savedPacks, savePack } from '~/lib/packs';
import { attachSticker } from '~/lib/send';

const STICKER_SIZE = 76;
const LANGUAGE = Intl.DateTimeFormat().resolvedOptions().locale.replace('-', '_');

type SheetProps = { channelId: string; folder: string; onClose: () => void };

type PackGridProps = { pack: Pack; onPick: (sticker: Sticker) => void; onRemove: () => void };

function PackGrid({ pack, onPick, onRemove }: PackGridProps) {
	return (
		<View style={{ gap: 8 }}>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<Discord.Text variant='text-md/semibold'>{pack.title}</Discord.Text>
				<Discord.Button
					size='sm'
					variant='secondary'
					text={messages.REMOVE}
					onPress={onRemove}
				/>
			</View>
			<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
				{pack.stickers.map((sticker) => (
					<Pressable key={sticker.id} onPress={() => onPick(sticker)}>
						<Image
							source={{ uri: stickerUrl(sticker.id) }}
							style={{ width: STICKER_SIZE, height: STICKER_SIZE }}
							resizeMode='contain'
						/>
					</Pressable>
				))}
			</View>
		</View>
	);
}

function StickerSheet({ channelId, folder, onClose }: SheetProps) {
	const [packs, setPacks] = useState(savedPacks);
	const [link, setLink] = useState('');
	const [loading, setLoading] = useState(false);

	async function add() {
		const id = packId(link);

		if (!id) {
			toasts.warning('NOT_A_PACK');

			return;
		}

		setLoading(true);

		try {
			const pack = await fetchPack(id, LANGUAGE);

			savePack(pack);
			setPacks(savedPacks());
			setLink('');
			toasts.success('ADDED', { title: pack.title });
		} catch (error) {
			logger.error(`Failed to load LINE pack ${id}:`, error);
			toasts.warning('ADD_FAILED', {
				reason: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setLoading(false);
		}
	}

	function remove(id: string) {
		removePack(id);
		setPacks(savedPacks());
	}

	async function pick(sticker: Sticker) {
		onClose();

		if (!(await attachSticker(channelId, sticker, folder))) toasts.warning('ATTACH_FAILED');
	}

	return (
		<Discord.ActionSheet>
			<ScrollView contentContainerStyle={{ gap: 16, padding: 16 }}>
				<Discord.Text variant='heading-lg/semibold'>{messages.TITLE}</Discord.Text>
				<Discord.TextInput
					description={messages.LINK_HELP}
					autoCorrect={false}
					autoCapitalize='none'
					value={link}
					onChange={setLink}
				/>
				<Discord.Button
					text={messages.ADD}
					loading={loading}
					disabled={!link.trim() || loading}
					onPress={() => void add()}
				/>
				{packs.length ? (
					packs.map((pack) => (
						<PackGrid
							key={pack.id}
							pack={pack}
							onPick={(sticker) => void pick(sticker)}
							onRemove={() => remove(pack.id)}
						/>
					))
				) : (
					<Discord.Text variant='text-sm/medium'>{messages.EMPTY}</Discord.Text>
				)}
			</ScrollView>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the sticker pack picker for a channel.
 * @param channelId The channel whose chat input gets the picked sticker.
 * @param folder The plugin's temporary folder.
 */
export function openStickerSheet(channelId: string, folder: string): void {
	openSheet('unbound-external-sticker-packs', StickerSheet, { channelId, folder });
}

export default StickerSheet;
