import { Image, View } from 'react-native';

import useStyles from './logo-row-icon.style';
import getLogoAssetIds from './logo-asset';

/**
 * @description The Unbound logo as a settings row icon: its registered fringes untinted, and its body over them in the
 * colour Discord's `TableRowIcon` uses. Both are assets, so an icon pack or add-on can replace them.
 */
function LogoRowIcon() {
	const styles = useStyles();
	const { body, fringes } = getLogoAssetIds();

	return (
		<View style={styles.icon}>
			<Image source={fringes} style={styles.layer} />
			<Image source={body} style={styles.body} />
		</View>
	);
}

export default LogoRowIcon;
