// Each tone tries Discord's theme tokens in order, then a fixed color when the theme has none.
export const TONE_COLORS = {
	primary: { tokens: ['BRAND_330', 'BRAND_500'], fallback: '#5865f2' },
	muted: { tokens: ['TEXT_NORMAL'], fallback: '#f2f3f5' },
	yellow: { tokens: ['YELLOW_330', 'YELLOW_300'], fallback: '#fee75c' },
	orange: { tokens: ['ORANGE_330', 'ORANGE_300'], fallback: '#f0b232' },
	red: { tokens: ['RED_360', 'RED_400'], fallback: '#ed4245' },
};
