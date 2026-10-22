import { metro } from '@unbound-app/api';

export type ReviewColors = {
	page: string;
	surface: string;
	surfaceAlt: string;
	input: string;
	border: string;
	text: string;
	muted: string;
	accent: string;
	accentText: string;
	positive: string;
	danger: string;
	link: string;
};

export function getReviewColors(): ReviewColors {
	const colors = ((metro.common.Theme as any)?.colors ?? {}) as Record<string, unknown>;
	const color = (key: string, fallback: string): string =>
		typeof colors[key] === 'string' ? (colors[key] as string) : fallback;

	return {
		page: color('BACKGROUND_MOBILE_PRIMARY', color('BACKGROUND_PRIMARY', '#111214')),
		surface: color('BACKGROUND_SECONDARY', '#1e1f22'),
		surfaceAlt: color('BACKGROUND_SECONDARY_ALT', '#232428'),
		input: color('BACKGROUND_TERTIARY', '#111214'),
		border: color('BACKGROUND_MODIFIER_ACCENT', '#4e5058'),
		text: color('TEXT_NORMAL', '#f2f3f5'),
		muted: color('TEXT_MUTED', '#b5bac1'),
		accent: color('BRAND_500', '#5865f2'),
		accentText: '#ffffff',
		positive: color('GREEN_360', '#23a559'),
		danger: color('RED_400', '#ed4245'),
		link: color('TEXT_LINK', '#00a8fc'),
	};
}
