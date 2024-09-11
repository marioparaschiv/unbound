import type { BuiltInData } from '@typings/built-ins';
import { createPatcher } from '@patcher';
import { findByProps } from '@api/metro';
import themes from '@managers/themes';
import { Image } from 'react-native';
import { Documents } from '@api/fs';

const Patcher = createPatcher('unbound::design');

export const data: BuiltInData = {
	name: 'Design'
};

export function start() {
	patchImageResolver();
	patchThemeChacteristics();
}

export function stop() {
	Patcher.unpatchAll();
}

function patchImageResolver() {
	// @ts-expect-error - RN.Image has no 'render' method defined in its types
	Patcher.before(Image, 'render', (_, [props]) => {
		const identifier = '{__path__}';
		const { source } = props;

		// This is required because the bundle uid changes between versions, so it cannot be hardcoded in the manifest.
		// Therefore the string {__path__} is put in the manifest instead, and it is hydrated into the proper path below.
		if (typeof source === 'object' && source.uri && source.uri.includes(identifier)) {
			props.source = { ...props.source };
			props.source.uri = source.uri.replace(identifier, Documents);
		}
	});
}

function patchThemeChacteristics() {
	const ThemeBooleans = findByProps('isThemeDark', 'isThemeLight');

	function handleThemeType(theme: string, orig: Fn, arg: string) {
		const appliedTheme = themes.entities.get(theme);

		if (!appliedTheme) {
			return orig();
		}

		const themeType = appliedTheme.instance?.type;

		switch (themeType) {
			case 'midnight':
			case 'darker':
			case 'amoled':
				return arg === 'dark';
			case 'light':
				return arg === 'light';
			default:
				return orig();
		}
	}

	Patcher.instead(ThemeBooleans, 'isThemeDark', (self, args, orig) => {
		return handleThemeType(args[0] as string, () => orig.apply(self, args), 'dark');
	});

	Patcher.instead(ThemeBooleans, 'isThemeLight', (self, args, orig) => {
		return handleThemeType(args[0] as string, () => orig.apply(self, args), 'light');
	});
}