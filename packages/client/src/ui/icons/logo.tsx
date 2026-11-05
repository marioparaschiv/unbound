import type { ColorValue } from 'react-native';

import { SVG } from '~/metro/common';

import buildLogoMarkup from './logo-markup';

/** The logo's width over its height, from its viewBox. */
export const LOGO_ASPECT_RATIO = 191.19 / 152.94;

const markups = new Map<boolean, string>();

type LogoProps = {
	/** The logo's height; its width follows the logo's proportions. */
	height: number;
	/** The body's colour, resolved, not a theme token; the red and cyan fringes keep theirs. White when omitted. */
	tint?: ColorValue;
	/** Whether to draw the drop shadow and scanlines; turn off at icon sizes, where they muddy the mark. */
	textured?: boolean;
};

/**
 * @description The Unbound logo as the website draws it, its body tinted and its colour fringes kept.
 */
function Logo({ height, tint = '#FFFFFF', textured = true }: LogoProps) {
	let markup = markups.get(textured);

	if (!markup) {
		markup = buildLogoMarkup(textured);
		markups.set(textured, markup);
	}

	return (
		<SVG.SvgXml xml={markup} width={height * LOGO_ASPECT_RATIO} height={height} color={tint} />
	);
}

export default Logo;
