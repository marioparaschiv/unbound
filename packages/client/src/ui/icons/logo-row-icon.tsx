import { View } from 'react-native';

import useStyles, { ROW_ICON_SIZE } from './logo-row-icon.style';
import Logo, { LOGO_ASPECT_RATIO } from './logo';

/**
 * @description The Unbound logo sized and centred as a settings row icon, its body in the colour Discord's
 * `TableRowIcon` uses and without the shadow and scanlines. The logo is wider than tall, so it fills the width.
 */
function LogoRowIcon() {
	const styles = useStyles();

	return (
		<View style={styles.icon}>
			<Logo
				height={ROW_ICON_SIZE / LOGO_ASPECT_RATIO}
				tint={styles.logo.color}
				textured={false}
			/>
		</View>
	);
}

export default LogoRowIcon;
