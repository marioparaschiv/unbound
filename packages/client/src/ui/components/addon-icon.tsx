import type { AddonKind } from '@unbound-app/types/addons';
import { View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/metro/components';
import { SVG, Theme } from '~/metro/common';

import DEFAULT_ADDON_ICONS from './default-addon-icons';
import useAddonIconSvg from './use-addon-icon-svg';
import useStyles from './addon-icon.style';

type AddonIconProps = {
	id: string;
	kind: AddonKind;
	/** The tile's width and height; the glyph takes just over half of it. */
	size?: number;
};

/**
 * @description An addon's website icon in a rounded tile: the one its maintainers picked, from the
 * stored catalog, else the kind's default. The markup's `currentColor` takes the strong text colour.
 */
function AddonIcon({ id, kind, size = 40 }: AddonIconProps) {
	const styles = useStyles();
	const svg = useAddonIconSvg(id) ?? DEFAULT_ADDON_ICONS[kind];
	const glyph = Math.round(size * 0.55);
	// The SVG's color prop takes a plain string, not the theme's dynamic colour object.
	const color = Discord.useToken(Theme.colors.TEXT_STRONG);

	return (
		<View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3 }]}>
			<SVG.SvgXml xml={svg} width={glyph} height={glyph} color={color} />
		</View>
	);
}

export default memo(AddonIcon);
