import type { AddonKind } from '@unbound-app/types/addons';
import { View } from 'react-native';
import { memo } from 'react';

import { SVG } from '~/metro/common';

import DEFAULT_ADDON_ICONS from './default-addon-icons';
import useAddonIconSvg from './use-addon-icon-svg';
import useStyles from './addon-icon.style';

type AddonIconProps = {
	id: string;
	kind: AddonKind;
	/** `large` heads a store page, as the website's addon header does. */
	size?: 'default' | 'large';
};

const GLYPH_SIZES = { default: 22, large: 32 };

/**
 * @description An addon's website icon in a rounded tile: the one its maintainers picked, from the
 * stored catalog, else the kind's default. The markup's `currentColor` takes the strong text colour.
 */
function AddonIcon({ id, kind, size = 'default' }: AddonIconProps) {
	const styles = useStyles();
	const svg = useAddonIconSvg(id) ?? DEFAULT_ADDON_ICONS[kind];
	const glyph = GLYPH_SIZES[size];

	return (
		<View style={[styles.tile, size === 'large' ? styles.large : null]}>
			<SVG.SvgXml xml={svg} width={glyph} height={glyph} color={styles.glyph.color} />
		</View>
	);
}

export default memo(AddonIcon);
