import { IconGrid, IconColorPalette, IconPlug } from 'nucleo-micro-bold';
import type { ComponentType } from 'react';

import type { CssVariables } from '~/lib/css-variables';

export type ListingType = 'plugin' | 'theme' | 'icon-pack';

type IconProps = {
	className?: string;
};

type ListingCopy = {
	title: string;
	description: string;
	plural: string;
	icon: ComponentType<IconProps>;
};

export const LISTING_GRID_STYLE: CssVariables = { '--col-width': '300px' };

export const LISTING_COPY: Record<ListingType, ListingCopy> = {
	plugin: {
		title: 'Plugins',
		description: 'Extend your app with powerful plugins built by the community.',
		plural: 'plugins',
		icon: IconPlug,
	},
	theme: {
		title: 'Themes',
		description: 'Customize the appearance of your app to the fullest.',
		plural: 'themes',
		icon: IconColorPalette,
	},
	'icon-pack': {
		title: 'Icons',
		description: 'Swap the icons across your app for a whole new set.',
		plural: 'icon packs',
		icon: IconGrid,
	},
};

export default { LISTING_COPY, LISTING_GRID_STYLE };
