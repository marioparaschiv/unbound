import { View } from 'react-native';

import { Discord } from '~/metro/components';
import { Theme } from '~/metro/common';

import useStyles, { ROW_ICON_SIZE } from './logo-row-icon.style';
import Logo, { LOGO_ASPECT_RATIO } from './logo';

/**
 * @description The Unbound logo sized and centred as a settings row icon, its body in the colour Discord's
 * `TableRowIcon` uses and without the shadow and scanlines. The logo is wider than tall, so it fills the width.
 */
function LogoRowIcon() {
	const styles = useStyles();
	// SVG colour props take a plain string, not the theme's dynamic colour object.
	const tint = Discord.useToken(Theme.colors.TABLEROW_ICON_COLOR_DEFAULT);

	return (
		<View style={styles.icon}>
			<Logo height={ROW_ICON_SIZE / LOGO_ASPECT_RATIO} tint={tint} textured={false} />
		</View>
	);
}

export default LogoRowIcon;
