import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { Image, Pressable, View } from 'react-native';
import { format, messages } from '@unbound-app/i18n';
import { assets, dialogs, toasts, ui } from '@unbound-app/api';
import { useState } from 'react';

import { fetchPack, packId, stickerUrl, type Pack, type Sticker } from '~/lib/line';
import { removePack, savedPacks, savePack } from '~/lib/packs';
import { attachSticker } from '~/lib/send';

import useStyles from '~/components/sticker-sheet.style';

const LANGUAGE = Intl.DateTimeFormat().resolvedOptions().locale.replace('-', '_');

type SheetProps = { channelId: string; folder: string; onClose: () => void };

type PackGridProps = { pack: Pack; onPick: (sticker: Sticker) => void; onRemove: () => void };

function PackGrid({ pack, onPick, onRemove }: PackGridProps) {
	const styles = useStyles();

	return (
		<View style={styles.pack}>
			<View style={styles.packHeader}>
				<Discord.TableRowGroupTitle title={pack.title} style={styles.packTitle} />
				<Discord.IconButton
					size='sm'
					variant='secondary'
					icon={assets.getIdByName('TrashIcon')}
					accessibilityLabel={format('REMOVE_LABEL', { title: pack.title })}
					onPress={onRemove}
				/>
			</View>
			<View style={styles.grid}>
				{pack.stickers.map((sticker) => (
					<Pressable key={sticker.id} onPress={() => onPick(sticker)}>
						<Image
							source={{ uri: stickerUrl(sticker.id) }}
							style={styles.sticker}
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
	const styles = useStyles();
	const [loading, setLoading] = useState(false);

	async function add(link: string) {
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

	async function remove(pack: Pack) {
		const confirmed = await dialogs.confirm('REMOVE_TITLE', {
			titleVars: { title: pack.title },
			confirm: 'REMOVE',
			destructive: true,
		});

		if (!confirmed) return;

		removePack(pack.id);
		setPacks(savedPacks());
	}

	async function pick(sticker: Sticker) {
		onClose();

		if (!(await attachSticker(channelId, sticker, folder))) toasts.warning('ATTACH_FAILED');
	}

	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;

	return (
		<ActionSheet scrollable>
			<BottomSheetTitleHeader title={messages.TITLE} />
			<ScrollView contentContainerStyle={styles.body}>
				<ui.Section>
					<ui.InputRow
						label={loading ? messages.ADDING : messages.ADD_PACK}
						subLabel={messages.LINK_HELP}
						placeholder={messages.LINK_PLACEHOLDER}
						keyboardType='url'
						value=''
						disabled={loading}
						onChange={(text) => void add(text)}
					/>
				</ui.Section>
				{packs.length ? (
					packs.map((pack) => (
						<PackGrid
							key={pack.id}
							pack={pack}
							onPick={(sticker) => void pick(sticker)}
							onRemove={() => void remove(pack)}
						/>
					))
				) : (
					<Discord.Text variant='body-sm/medium' color='text-muted' style={styles.empty}>
						{messages.EMPTY}
					</Discord.Text>
				)}
			</ScrollView>
		</ActionSheet>
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
