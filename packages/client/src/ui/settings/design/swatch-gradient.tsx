import { View } from 'react-native';

import { Gradients, type PickerTheme } from './appearance-picker';
import useStyles from './swatch-gradient.style';

type SwatchGradientProps = {
	item: PickerTheme;
};

/**
 * @description An Unbound theme's swatch: Discord's own gradient, undimmed, inside the border Discord gives its
 * standard swatches, so every swatch in the carousel keeps an edge against the page.
 */
function SwatchGradient({ item }: SwatchGradientProps) {
	const styles = useStyles();

	return (
		<View style={styles.swatch}>
			<Gradients.CustomThemedGradient
				customTheme={item}
				mix={false}
				componentStyles={styles.gradient}
			/>
		</View>
	);
}

export default SwatchGradient;
