import { View } from 'react-native';

import TintedIcon from '~/metro/fallbacks/tinted-icon';
import type { Addon } from '~/addons/addon';

import useStyles from './icon-pack-preview.style';
import usePackSamples from './use-pack-samples';

type IconPackPreviewProps = {
	pack: Addon;
};

/**
 * @description The picker's preview for an icon pack: a grid of common icons as the pack draws them, each on a round
 * button like Discord's header actions, in place of the mock "Messages" list that shows almost no icons.
 */
function IconPackPreview({ pack }: IconPackPreviewProps) {
	const styles = useStyles();
	const samples = usePackSamples(pack);

	return (
		<View style={styles.grid}>
			{samples.map((source) => (
				<View key={source.uri} style={styles.button}>
					<TintedIcon source={source} size={24} style={styles.icon} />
				</View>
			))}
		</View>
	);
}

export default IconPackPreview;
