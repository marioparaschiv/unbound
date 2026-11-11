import { Image, View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';
import { format } from '~/i18n/api';

import useStyles from './install-count-label.style';
import { formatInstalls } from './install-count';

type InstallCountLabelProps = {
	count: number;
	/** `card` abbreviates thousands for a card's tight line; `page` spells the number out. */
	variant?: 'card' | 'page';
};

/**
 * @description An addon's marketplace install count: a download icon beside the number, muted like the
 * text around it. Screen readers hear the count in words.
 */
function InstallCountLabel({ count, variant = 'card' }: InstallCountLabelProps) {
	const styles = useStyles();
	const card = variant === 'card';

	return (
		<View
			style={styles.label}
			accessible
			accessibilityLabel={format('UNBOUND_MARKETPLACE_INSTALLS', {
				count,
				value: formatInstalls(count),
			})}
		>
			<Image
				source={icons['DownloadIcon']}
				style={card ? styles.cardIcon : styles.pageIcon}
			/>
			<Discord.Text
				variant={card ? 'text-xs/medium' : 'text-sm/medium'}
				color='text-muted'
				numberOfLines={1}
			>
				{formatInstalls(count, card)}
			</Discord.Text>
		</View>
	);
}

export default memo(InstallCountLabel);
