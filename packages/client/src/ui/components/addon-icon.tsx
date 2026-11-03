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
};

/**
 * @description An addon's website icon in a rounded tile: the one its maintainers picked, from the
 * stored catalog, else the kind's default. The markup's `currentColor` takes the strong text colour.
 */
function AddonIcon({ id, kind }: AddonIconProps) {
	const styles = useStyles();
	const svg = useAddonIconSvg(id) ?? DEFAULT_ADDON_ICONS[kind];
	// The SVG's color prop takes a plain string, not the theme's dynamic colour object.
	const color = Discord.useToken(Theme.colors.TEXT_STRONG);

	return (
		<View style={[styles.tile, { width: 40, height: 40, borderRadius: 12 }]}>
			<SVG.SvgXml xml={svg} width={22} height={22} color={color} />
		</View>
	);
}

export default memo(AddonIcon);
