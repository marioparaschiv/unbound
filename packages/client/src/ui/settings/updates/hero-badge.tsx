import { View } from 'react-native';

import type { BadgeLook } from './use-badge-layers';

import HeroBadgeLayer from './hero-badge-layer';
import useBadgeLayers from './use-badge-layers';
import useStyles from './hero-badge.style';

/**
 * @description The coloured badge at the top of the updates page. Each change of look pops the old badge
 * out while the new one springs in; the checking badge spins.
 */
function HeroBadge(look: BadgeLook) {
	const styles = useStyles();
	const layers = useBadgeLayers(look);

	return (
		<View style={styles.badge}>
			{layers.map((layer) => (
				<HeroBadgeLayer key={layer.id} {...layer} />
			))}
		</View>
	);
}

export default HeroBadge;
