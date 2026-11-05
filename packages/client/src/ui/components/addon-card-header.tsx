import type { AddonKind } from '@unbound-app/types/addons';
import type { AddonManifest } from '@unbound-app/types';
import { View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/metro/components';

import useStyles from './addon-card-header.style';
import AddonTitle from './addon-title';
import AddonIcon from './addon-icon';

/** The manifest fields a card header shows; an installed addon's and a listed addon's both fit. */
export type AddonCardManifest = Pick<AddonManifest, 'name' | 'version' | 'authors' | 'description'>;

type AddonCardHeaderProps = {
	id: string;
	kind: AddonKind;
	manifest: AddonCardManifest;
};

/**
 * @description The top of an addon card: the addon's icon, its name with its version, the author,
 * and the description. Pure and memoized; it reads nothing from any manager.
 */
function AddonCardHeader({ id, kind, manifest }: AddonCardHeaderProps) {
	const styles = useStyles();
	const { name, version, authors, description } = manifest;
	const author = authors?.map((a) => a.name).join(', ');

	return (
		<Discord.Stack direction='horizontal' spacing={12} align='flex-start'>
			<AddonIcon id={id} kind={kind} />
			<View style={styles.content}>
				<AddonTitle name={name} version={version} />
				{author ? (
					<Discord.Text variant='text-xs/medium' style={styles.author} numberOfLines={1}>
						by {author}
					</Discord.Text>
				) : null}
				{description ? (
					<Discord.Text variant='text-sm/normal' style={styles.description}>
						{description}
					</Discord.Text>
				) : null}
			</View>
		</Discord.Stack>
	);
}

export default memo(AddonCardHeader);
