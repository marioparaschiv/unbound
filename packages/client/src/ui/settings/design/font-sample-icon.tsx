import { View } from 'react-native';

import useStyles from './font-sample-icon.style';
import FontSample from './font-sample';

type FontSampleIconProps = {
	/** As {@link FontSample}'s `family`. */
	family?: string;
	/** As {@link FontSample}'s `italic`. */
	italic?: boolean;
};

/** @description "Aa" in one font, sized as a row's leading icon. */
function FontSampleIcon({ family, italic = false }: FontSampleIconProps) {
	const styles = useStyles();

	return (
		<View style={styles.icon}>
			<FontSample text='Aa' family={family} variant='text-lg/normal' italic={italic} />
		</View>
	);
}

export default FontSampleIcon;
