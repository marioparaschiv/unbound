import { View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/metro/components';

import useStyles from './addon-tag.style';

type AddonTagProps = {
	children: string;
	variant?: 'default' | 'brand';
};

/**
 * @description A small pill labelling an addon, such as its version or "Dev". Smaller than Discord's `Badge`,
 * which takes no size; `brand` colours the label.
 */
function AddonTag({ children, variant = 'default' }: AddonTagProps) {
	const styles = useStyles();

	return (
		<View style={styles.tag}>
			<Discord.Text
				variant='text-xxs/semibold'
				numberOfLines={1}
				style={variant === 'brand' ? styles.brandLabel : styles.label}
			>
				{children}
			</Discord.Text>
		</View>
	);
}

export default memo(AddonTag);
