import { View } from 'react-native';
import { memo } from 'react';

import TintedIcon from '~/metro/fallbacks/tinted-icon';
import type { Addon } from '~/addons/addon';

import useStyles from './icon-pack-swatch.style';
import usePackSamples from './use-pack-samples';

type IconPackSwatchProps = {
	pack: Addon;
};

/**
 * @description An icon pack's swatch: the same icon from each pack on Discord's background, so neighbours compare at a glance.
 */
function IconPackSwatch({ pack }: IconPackSwatchProps) {
	const styles = useStyles();
	const [icon] = usePackSamples(pack);

	return (
		<View style={styles.swatch}>
			{icon ? <TintedIcon source={icon} size={24} style={styles.icon} /> : null}
		</View>
	);
}

export default memo(IconPackSwatch);
