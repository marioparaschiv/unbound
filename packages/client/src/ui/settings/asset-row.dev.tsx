import type { UnboundAsset } from '@unbound-app/types';
import { memo, useRef } from 'react';
import { Image } from 'react-native';

import { Discord, Media } from '~/metro/components';
import { findByProps } from '~/metro/lookups';

import useStyles from './asset-row.style';

export type Rect = { x: number; y: number; width: number; height: number };

export type ToScreen = (rect: Rect, done: (rect: Rect) => void) => void;

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
	/** Moves a rect measured inside the page onto the screen, where the media viewer lays out. */
	toScreen: ToScreen;
};

const AssetHandler = findByProps('getAssetUriForEmbed', { lazy: true });

/**
 * @description Opens an asset in Discord's fullscreen media viewer (pinch-to-zoom), growing out of the on-screen rect
 * passed as `originViewOrOriginLayout`; without one the viewer zooms in from the middle of the screen.
 */
function openAsset(id: number, origin: Rect) {
	if (!AssetHandler) return;

	const uri = AssetHandler.getAssetUriForEmbed(id);

	Image.getSize(uri, (width, height) => {
		Media.openMediaModal({
			originViewOrOriginLayout: { ...origin, resizeMode: 'contain' },
			initialIndex: 0,
			initialSources: [{ uri, sourceURI: uri, width, height }],
		});
	});
}

/**
 * @description One asset row, memoized so a keystroke only re-renders rows whose props changed. Tapping
 * anywhere on the row measures the thumbnail's on-screen rect and opens the media viewer anchored to it, so the
 * open animation grows from the thumbnail.
 */
function AssetRow({ item, index, total, toScreen }: AssetRowProps) {
	const styles = useStyles();
	const ref = useRef<Image>(null);
	const { asset, id } = item;

	function open() {
		ref.current?.measureInWindow((x, y, width, height) =>
			toScreen({ x, y, width, height }, (origin) => openAsset(id, origin)),
		);
	}

	return (
		<Discord.TableRow
			label={asset.name}
			start={index === 0}
			end={index === total - 1}
			onPress={open}
			trailing={<Discord.TableRow.TrailingText text={`${asset.width}×${asset.height}`} />}
			icon={
				// The thumbnail itself is measured: the icon slot around it is wider than the image.
				<Image ref={ref} source={id} style={styles.thumbnail} />
			}
		/>
	);
}

export default memo(AssetRow);
