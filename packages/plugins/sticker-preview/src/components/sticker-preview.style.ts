import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';

import { COMPOSER_ROW_RIGHT } from '@unbound-plugins/shared/composer/overlay-rows';

import { PREVIEW_SIZE, STICKER_SIZE } from '~/lib/constants';

// A factory, so the theme is read when the preview renders rather than when the plugin loads.
export default Discord.createStyles(() => {
	const { Theme } = metro.common;

	return {
		anchor: { position: 'absolute', right: COMPOSER_ROW_RIGHT, zIndex: 10 },
		frame: {
			alignItems: 'center',
			backgroundColor: Theme.colors?.BACKGROUND_SURFACE_HIGH,
			borderColor: Theme.colors?.BORDER_SUBTLE,
			borderRadius: Theme.radii?.lg,
			borderWidth: 1,
			height: PREVIEW_SIZE,
			justifyContent: 'center',
			overflow: 'hidden',
			width: PREVIEW_SIZE,
		},
		sticker: {
			borderRadius: Theme.radii?.md,
			height: STICKER_SIZE,
			overflow: 'hidden',
			width: STICKER_SIZE,
		},
	};
});
