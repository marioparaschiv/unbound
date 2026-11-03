import type { UnboundAsset } from '@unbound-app/types';
import { Image, View } from 'react-native';
import { memo, useRef } from 'react';

import { Discord, Media } from '~/metro/components';
import { findByProps } from '~/metro/search';

import useStyles from './assets.style';

/** An asset paired with its resolved id and a pre-lowercased name, computed once for the whole list. */
export type IndexedAsset = {
	asset: UnboundAsset;
	id: number;
	query: string;
};

type AssetRowProps = {
	item: IndexedAsset;
	index: number;
	total: number;
};

const AssetHandler = findByProps('getAssetUriForEmbed', { lazy: true });

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

/**
 * @description One asset row, memoized so a keystroke only re-renders rows whose props changed. Tapping
 * anywhere on the row measures the thumbnail's on-screen position and opens the media viewer anchored to
 * it, so the open animation grows from the thumbnail.
 */
function AssetRow({ item, index, total }: AssetRowProps) {
	const styles = useStyles();
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
					<Image source={id} style={styles.thumbnail} />
				</View>
			}
		/>
	);
}

export default memo(AssetRow);
