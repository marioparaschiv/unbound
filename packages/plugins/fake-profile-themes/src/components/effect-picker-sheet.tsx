import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { flux } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import useStyles from '~/components/effect-picker-sheet.style';
import { fetchShop, loadedProducts, profileEffects, type ProfileEffect } from '~/lib/effects';

/** Props of {@link EffectPickerSheet}. */
export type EffectPickerSheetProps = SheetProps & {
	selected: string;
	onPick: (skuId: string) => void;
};

const COLUMNS = 3;
const NONE: ProfileEffect = { skuId: '', title: '' };

const CategoryStore = flux.getStore('CollectiblesCategory');

type TileProps = { effect: ProfileEffect; selected: boolean; onPress: () => void };

function EffectTile({ effect, selected, onPress }: TileProps) {
	const styles = useStyles();
	const title = effect.skuId ? effect.title : messages.NO_EFFECT;

	return (
		<Pressable
			style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
			accessibilityRole='button'
			accessibilityLabel={title}
			accessibilityState={{ selected }}
			onPress={onPress}
		>
			<View style={[styles.preview, selected && styles.selected]}>
				{effect.thumbnailPreviewSrc ? (
					<Image
						source={{ uri: effect.thumbnailPreviewSrc }}
						style={styles.image}
						resizeMode='cover'
					/>
				) : null}
			</View>
			<Discord.Text variant='text-xs/medium' color='text-muted' lineClamp={1}>
				{title}
			</Discord.Text>
		</Pressable>
	);
}

function matches(effect: ProfileEffect, query: string): boolean {
	return !query || effect.title.toLowerCase().includes(query.toLowerCase());
}

function rowsOf(effects: ProfileEffect[]): ProfileEffect[][] {
	return Array.from({ length: Math.ceil(effects.length / COLUMNS) }, (_, row) =>
		effects.slice(row * COLUMNS, row * COLUMNS + COLUMNS),
	);
}

/**
 * @description A sheet of Discord's profile effects to hide in the bio code, with a search and a "None" choice.
 * @param props The effect picked now and what to do with a new pick.
 * @returns The sheet.
 */
function EffectPickerSheet({ selected, onPick, onClose }: EffectPickerSheetProps) {
	const styles = useStyles();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetFlatList: FlatList } = GorhomSheet;
	const [query, setQuery] = useState('');
	const effects = flux.useStore(CategoryStore, () => profileEffects(loadedProducts()));
	const shown = [NONE, ...effects].filter((effect) => !effect.skuId || matches(effect, query));

	useEffect(() => {
		if (!effects.length) fetchShop();
	}, [effects.length]);

	function pick(skuId: string) {
		onPick(skuId);
		onClose();
	}

	return (
		<ActionSheet scrollable>
			<BottomSheetTitleHeader title={messages.EFFECT} />
			<FlatList
				data={rowsOf(shown)}
				keyExtractor={(row: ProfileEffect[]) => row.map((effect) => effect.skuId).join()}
				contentContainerStyle={styles.list}
				keyboardShouldPersistTaps='handled'
				ListHeaderComponent={
					<View style={styles.search}>
						<Discord.SearchBar
							size='md'
							value={query}
							onChange={setQuery}
							placeholder={messages.SEARCH_EFFECTS}
						/>
					</View>
				}
				ListFooterComponent={effects.length ? null : <Discord.ActivityIndicator />}
				renderItem={({ item: row }: { item: ProfileEffect[] }) => (
					<View style={styles.row}>
						{row.map((effect) => (
							<EffectTile
								key={effect.skuId}
								effect={effect}
								selected={effect.skuId === selected}
								onPress={() => pick(effect.skuId)}
							/>
						))}
						{Array.from({ length: COLUMNS - row.length }, (_, index) => (
							<View key={index} style={styles.spacer} />
						))}
					</View>
				)}
			/>
		</ActionSheet>
	);
}

export default EffectPickerSheet;
