import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

import type { BadgeColor } from '~/lib/badges';

const BADGE_COLORS: BadgeColor[] = [
	'BACKGROUND_BRAND',
	'STATUS_POSITIVE',
	'STATUS_WARNING',
	'STATUS_DANGER',
	'INTERACTIVE_MUTED',
	'BACKGROUND_MOD_STRONG',
];

export default Discord.createStyles(() => {
	const { Theme } = metro.common;

	return {
		row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 6 },
		badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
		...Object.fromEntries(
			BADGE_COLORS.map((color) => [color, { backgroundColor: Theme.colors?.[color] }]),
		),
	} as Record<'row' | 'badge' | BadgeColor, object>;
});
