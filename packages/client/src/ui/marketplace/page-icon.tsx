import { memo } from 'react';

import { SVG } from '~/metro/common';

import useStyles from './page-icon.style';

type PageIconProps = {
	/** The icon's `<svg>` markup from the version's sprite. */
	svg: string;
	size?: number;
};

/** @description An ADDON.md `:name:` icon in the brand colour, as the website draws it. */
function PageIcon({ svg, size = 16 }: PageIconProps) {
	const styles = useStyles();

	return <SVG.SvgXml xml={svg} width={size} height={size} color={styles.glyph.color} />;
}

export default memo(PageIcon);
