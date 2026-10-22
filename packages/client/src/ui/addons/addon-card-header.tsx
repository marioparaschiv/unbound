import type { AddonManifest } from '@unbound-app/types';
import { View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/api/metro/components';
import { TintedIcon } from '~/ui/components';
import { Theme } from '~/api/metro/common';
import { Icons } from '~/api/assets';

import useStyles from './addon-card-header.style';
import AddonTitle from './addon-title';

/** The manifest fields a card header shows; an installed addon's and a listed addon's both fit. */
export type AddonCardManifest = Pick<AddonManifest, 'name' | 'version' | 'authors' | 'description'>;

type AddonCardHeaderProps = {
	manifest: AddonCardManifest;
	/** The asset name of the tinted icon. */
	icon?: string;
};

/**
 * @description The top of an addon card: a tinted icon, the addon name with its version, the author,
 * and the description. Pure and memoized; it reads nothing from any manager.
 */
function AddonCardHeader({ manifest, icon = 'PuzzlePieceIcon' }: AddonCardHeaderProps) {
	const styles = useStyles();
	const { name, version, authors, description } = manifest;
	const author = authors?.map((a) => a.name).join(', ');

	return (
		<View style={styles.container}>
			<View style={styles.iconContainer}>
				<TintedIcon source={Icons[icon] ?? 0} size={22} tint={Theme.colors.TEXT_STRONG} />
			</View>
			<View style={styles.content}>
				<AddonTitle name={name} version={version} />
				{author ? (
					<Discord.Text
						variant='text-xs/medium'
						style={{ color: Theme.colors.TEXT_MUTED }}
						numberOfLines={1}
					>
						by {author}
					</Discord.Text>
				) : null}
				{description ? (
					<Discord.Text
						variant='text-sm/normal'
						style={[styles.description, { color: Theme.colors.TEXT_DEFAULT }]}
					>
						{description}
					</Discord.Text>
				) : null}
			</View>
		</View>
	);
}

export default memo(AddonCardHeader);
