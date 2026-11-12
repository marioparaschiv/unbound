import { View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/metro/components';

import useStyles from './addon-tag.style';

type AddonTagProps = {
	children: string;
	variant?: AddonTagVariant;
};

/** `brand` colours the label; `new` is a red pill with a white label. */
export type AddonTagVariant = 'default' | 'brand' | 'new';

/**
 * @description A small pill labelling an addon, such as its version or "Dev". Smaller than Discord's `Badge`,
 * which takes no size; `brand` colours the label.
 */
const LABELS: Record<AddonTagVariant, (styles: ReturnType<typeof useStyles>) => object> = {
	default: (styles) => styles.label,
	brand: (styles) => styles.brandLabel,
	new: (styles) => styles.newLabel,
};

function AddonTag({ children, variant = 'default' }: AddonTagProps) {
	const styles = useStyles();

	return (
		<View style={[styles.tag, variant === 'new' && styles.newTag]}>
			<Discord.Text
				variant={variant === 'new' ? 'text-xxs/bold' : 'text-xxs/semibold'}
				numberOfLines={1}
				style={LABELS[variant](styles)}
			>
				{children}
			</Discord.Text>
		</View>
	);
}

export default memo(AddonTag);
