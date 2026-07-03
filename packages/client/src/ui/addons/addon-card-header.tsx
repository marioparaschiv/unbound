import type { Addon } from '@unbound-app/types';
import { View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/api/metro/components';
import { TintedIcon } from '~/ui/components';
import { Icons } from '~/api/assets';

type AddonCardHeaderProps = {
	addon: Addon;
};

/**
 * @description The top of an addon card: a tinted icon, the addon name with its version, the author,
 * and the description. Pure and memoized; it reads nothing from any manager.
 */
function AddonCardHeader({ addon }: AddonCardHeaderProps) {
	const { name, version, authors, description } = addon.data;
	const author = authors?.map((a) => a.name).join(', ');

	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
			<TintedIcon source={Icons['PuzzlePieceIcon'] ?? 0} size={20} />
			<View style={{ flex: 1, gap: 2 }}>
				<Discord.Text variant='text-md/semibold' color='header-primary'>
					{name}
					{version ? ` v${version}` : ''}
				</Discord.Text>
				{author ? (
					<Discord.Text variant='text-xs/medium' color='text-muted'>
						{author}
					</Discord.Text>
				) : null}
				{description ? (
					<Discord.Text variant='text-sm/normal' color='text-normal'>
						{description}
					</Discord.Text>
				) : null}
			</View>
		</View>
	);
}

export default memo(AddonCardHeader);
