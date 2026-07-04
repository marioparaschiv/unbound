import { useMemo, useState, useRef, memo } from 'react';
import type { UnboundAsset } from '@unbound-app/types';
import { Image, View } from 'react-native';

import { Discord, FlashList, Media } from '~/api/metro/components';
import { getAll, getIDByName, Icons } from '~/api/assets';
import { Messages, format } from '~/api/i18n';
import { findByProps } from '~/api/metro';
import { Empty } from '~/ui/components';

/** An asset paired with its resolved id and a pre-lowercased name, computed once for the whole list. */
type IndexedAsset = {
	asset: UnboundAsset;
	id: number;
	query: string;
};

type AssetRowInfo = { item: IndexedAsset; index: number };

const AssetHandler = findByProps('getAssetUriForEmbed', { lazy: true });

const THUMBNAIL_SIZE = 24;
const thumbnailStyle = { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE } as const;

const searchIcon = () => <Discord.TableRowIcon source={Icons.MagnifyingGlassIcon} />;

/**
 * @description Opens an asset in Discord's fullscreen media viewer (pinch-to-zoom). The viewer grows
 * out of `originLayout`, so a real on-screen rect is passed as the origin; a zero-size origin makes the
 * viewer appear to open from the whole screen instead.
 */
function openAsset(id: number, x: number, y: number, size: number) {
	const uri = AssetHandler.getAssetUriForEmbed(id);

	Image.getSize(uri, (width, height) => {
		Media.openMediaModal({
			originLayout: { x, y, width: size, height: size, resizeMode: 'cover' },
			initialIndex: 0,
			initialSources: [{ uri, sourceURI: uri, width, height }],
		});
	});
}

type AssetRowProps = {
	item: IndexedAsset;
	index: number;
	total: number;
};

/**
 * @description One asset row, memoized so a keystroke only re-renders rows whose props changed. Tapping
 * anywhere on the row measures the thumbnail's on-screen position and opens the media viewer anchored to
 * it, so the open animation grows from the thumbnail.
 */
function AssetRow({ item, index, total }: AssetRowProps) {
	const ref = useRef<View>(null);
	const { asset, id } = item;

	function open() {
		ref.current?.measureInWindow((x, y, width) => openAsset(id, x, y, width));
	}

	return (
		<Discord.TableRow
			label={asset.name}
			start={index === 0}
			end={index === total - 1}
			onPress={open}
			trailing={<Discord.TableRow.TrailingText text={`${asset.width}×${asset.height}`} />}
			icon={
				<View ref={ref} collapsable={false}>
					<Image source={id} style={thumbnailStyle} />
				</View>
			}
		/>
	);
}

const MemoAssetRow = memo(AssetRow);

/**
 * @description Searchable browser over registered PNG assets, previewing each as a thumbnail.
 */
function AssetsPage() {
	const [search, setSearch] = useState('');

	// Resolve ids and pre-lowercase names once, dropping assets that don't resolve, so neither the
	// per-row lookup nor the per-keystroke case-folding happens during render.
	const assets = useMemo(() => {
		const indexed: IndexedAsset[] = [];

		for (const asset of getAll()) {
			if (asset.type !== 'png') continue;

			const id = getIDByName(asset.name);
			if (!id) continue;

			indexed.push({ asset, id, query: asset.name.toLowerCase() });
		}

		return indexed;
	}, []);

	const filtered = useMemo(() => {
		if (!search) return assets;

		const query = search.toLowerCase();
		return assets.filter((entry) => entry.query.includes(query));
	}, [assets, search]);

	const total = filtered.length;

	return (
		<View style={{ flex: 1, padding: 16, gap: 12 }}>
			<View style={{ flexGrow: 0, flexShrink: 0 }}>
				<Discord.TextField
					size='md'
					value={search}
					onChange={setSearch}
					isClearable
					isRound
					placeholder={format('UNBOUND_SEARCH', { type: Messages.UNBOUND_ASSETS })}
					leadingIcon={searchIcon}
				/>
			</View>
			{total ? (
				<FlashList.FlashList
					data={filtered}
					keyExtractor={(entry: IndexedAsset) => entry.asset.name}
					estimatedItemSize={48}
					renderItem={({ item, index }: AssetRowInfo) => (
						<MemoAssetRow item={item} index={index} total={total} />
					)}
				/>
			) : (
				<Empty>
					{search ? Messages.UNBOUND_EMPTY_RESULTS : Messages.UNBOUND_NO_ASSETS}
				</Empty>
			)}
		</View>
	);
}

export default AssetsPage;
