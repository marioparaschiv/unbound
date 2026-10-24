export type RoleColorStops = {
	primaryColor: string;
	secondaryColor?: string;
	tertiaryColor?: string;
};

export type RoleColorStyle = 'solid' | 'gradient' | 'holographic';

export type RoleColorAppearance = {
	colors: string[];
	style: RoleColorStyle;
};

export type NativeColor = {
	hex: string;
	alpha: number;
};

export type RoleColorRun = {
	text: string;
	color: string;
};

/**
 * @description Checks that a value is a `#rrggbb` hex color.
 * @param color The value to check.
 * @returns Whether the value is a six-digit hex color string.
 */
export function isHexColor(color: unknown): color is string {
	return typeof color === 'string' && /^#[\da-f]{6}$/i.test(color);
}

/**
 * @description Converts red, green and blue components in the 0-1 range to a hex color.
 * @param red The red component.
 * @param green The green component.
 * @param blue The blue component.
 * @returns The `#rrggbb` color, or `null` when a component is outside 0-1.
 */
export function colorComponentsToHex(red: number, green: number, blue: number): string | null {
	const components = [red, green, blue];

	if (components.some((component) => !(component >= 0 && component <= 1))) return null;

	return `#${components
		.map((component) =>
			Math.round(component * 255)
				.toString(16)
				.padStart(2, '0'),
		)
		.join('')}`;
}

/**
 * @description Parses the `description` of a `UIColor` in the extended sRGB or gray color space.
 * @param description The color's description, such as `UIExtendedSRGBColorSpace 1 0 0 1`.
 * @returns The color's hex value and alpha, or `null` for any other color space.
 */
export function parseNativeColorDescription(description: string): NativeColor | null {
	const [space, ...values] = description.trim().split(/\s+/);
	const components = values.map(Number);
	let channels: number[];
	let alpha: number;

	if (space === 'UIExtendedSRGBColorSpace' && components.length === 4) {
		channels = components.slice(0, 3);
		alpha = components[3];
	} else if (space === 'UIExtendedGrayColorSpace' && components.length === 2) {
		channels = [components[0], components[0], components[0]];
		alpha = components[1];
	} else {
		return null;
	}

	if (!(alpha >= 0 && alpha <= 1)) return null;

	const hex = colorComponentsToHex(channels[0], channels[1], channels[2]);

	return hex ? { hex, alpha } : null;
}

/**
 * @description Builds the cache key for a role label rendered in a color.
 * @param label The role label.
 * @param color The label's hex color.
 * @returns A key that ignores case and surrounding whitespace.
 */
export function getRoleGradientKey(label: string, color: string): string {
	return `${label.trim().toLowerCase()}:${color.toLowerCase()}`;
}

/**
 * @description Lists a role's distinct valid color stops, primary first.
 * @param colors The role's enhanced colors.
 * @param fallbackColor The plain role color, used when the enhanced primary color is missing.
 * @param includeEnhanced Whether to include the secondary and tertiary stops.
 * @returns The valid, deduplicated hex stops, or an empty list when the role has no color.
 */
export function getRoleColorStops(
	colors: RoleColorStops | null | undefined,
	// UNKNOWN: callers pass Discord's untyped `colorString` fields as they are.
	fallbackColor: unknown,
	includeEnhanced: boolean = true,
): string[] {
	const primary = isHexColor(colors?.primaryColor) ? colors.primaryColor : fallbackColor;

	if (!isHexColor(primary)) {
		return [];
	}

	if (!includeEnhanced) {
		return [primary];
	}

	return [primary, colors?.secondaryColor, colors?.tertiaryColor].filter(
		(color, index, stops): color is string =>
			isHexColor(color) && stops.indexOf(color) === index,
	);
}

/**
 * @description Describes how a role's color renders: its stops, and whether it is solid, a gradient or holographic.
 * @param colors The role's enhanced colors.
 * @param fallbackColor The plain role color, used when the enhanced primary color is missing.
 * @param includeEnhanced Whether to include the secondary and tertiary stops.
 * @returns The role's color stops and style.
 */
export function getRoleColorAppearance(
	colors: RoleColorStops | null | undefined,
	// UNKNOWN: callers pass Discord's untyped `colorString` fields as they are.
	fallbackColor: unknown,
	includeEnhanced: boolean = true,
): RoleColorAppearance {
	const stops = getRoleColorStops(colors, fallbackColor, includeEnhanced);

	if (stops.length < 2) {
		return { colors: stops, style: 'solid' };
	}

	const holographic =
		includeEnhanced &&
		stops.length >= 3 &&
		isHexColor(colors?.secondaryColor) &&
		isHexColor(colors?.tertiaryColor);

	return { colors: stops, style: holographic ? 'holographic' : 'gradient' };
}

/**
 * @description Samples a role gradient at a position, interpolating between neighbouring stops.
 * @param colors The gradient's hex stops.
 * @param position Where to sample, from 0 (first stop) to 1 (last stop).
 * @returns The hex color at that position, or `null` when there are no stops or one is invalid.
 */
export function roleColorAt(colors: string[], position: number): string | null {
	if (!colors.length || !colors.every(isHexColor)) return null;

	if (colors.length === 1) {
		return colors[0];
	}

	const scaled = Math.min(1, Math.max(0, position)) * (colors.length - 1);
	const index = Math.min(colors.length - 2, Math.floor(scaled));
	const fraction = scaled - index;
	const first = Number.parseInt(colors[index].slice(1), 16);
	const second = Number.parseInt(colors[index + 1].slice(1), 16);
	const channels = [16, 8, 0].map((shift) =>
		Math.round(
			((first >> shift) & 0xff) * (1 - fraction) + ((second >> shift) & 0xff) * fraction,
		),
	);

	return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * @description Splits text into runs painted along a role gradient: one run for a solid color, one per character otherwise.
 * @param text The text to paint.
 * @param colors The role's hex stops.
 * @returns The runs in order, each with the color to paint it.
 */
export function roleColorRuns(text: string, colors: string[]): RoleColorRun[] {
	if (colors.length === 1) {
		return [{ text, color: colors[0] }];
	}

	const characters = Array.from(text);
	const last = Math.max(1, characters.length - 1);

	return characters.map((character, index) => ({
		text: character,
		color: roleColorAt(colors, index / last) ?? colors[0],
	}));
}

function relativeLuminance(color: string): number {
	const value = Number.parseInt(color.slice(1), 16);
	const [red, green, blue] = [16, 8, 0].map((shift) => {
		const channel = ((value >> shift) & 0xff) / 255;

		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});

	return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

/**
 * @description Picks black or white text, whichever contrasts more with every background.
 * @param backgrounds The hex colors the text sits on.
 * @returns `#000000` or `#ffffff`, white when there are no backgrounds.
 */
export function getContrastingTextColor(backgrounds: string[]): string {
	if (!backgrounds.length) {
		return '#ffffff';
	}

	const luminances = backgrounds.map(relativeLuminance);
	const whiteContrast = Math.min(...luminances.map((luminance) => 1.05 / (luminance + 0.05)));
	const blackContrast = Math.min(...luminances.map((luminance) => (luminance + 0.05) / 0.05));

	return blackContrast > whiteContrast ? '#000000' : '#ffffff';
}

export default {
	isHexColor,
	colorComponentsToHex,
	parseNativeColorDescription,
	getRoleGradientKey,
	getRoleColorStops,
	getRoleColorAppearance,
	roleColorAt,
	roleColorRuns,
	getContrastingTextColor,
};
