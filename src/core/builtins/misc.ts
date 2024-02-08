import type { BuiltIn } from '@typings/core/builtins';
import { ReactNative as RN } from '@metro/common';
import { DCDFileManager } from '@api/storage';
import { findInReactTree } from '@utilities';
import { createPatcher } from '@patcher';
import themes from '@managers/themes';
import { bulk } from '@metro';


const Patcher = createPatcher('misc');

export const data: BuiltIn['data'] = {
	id: 'modules.misc',
	default: true
};

export function initialize() {
	const [
		Icon,
		ThemeBooleans,
		Theming
	] = bulk(
		{ filter: m => m.TableRowIcon && !m.useCoachmark },
		{ filter: m => m.isThemeDark && !m.setThemeFlag },
		{ filter: m => m.updateTheme }
	)

	// Remove tintColor if the icon is a custom image (eg with a uri pointing to a badge)
	Patcher.after(Icon, 'TableRowIcon', (_, __, res) => {
		const image = findInReactTree(res, x => x.Sizes?.EXTRA_SMALL);
		if (typeof image?.type?.render !== 'function') return;


		Patcher.after(image.type, 'render', (_, [{ source }], res) => {
			if (typeof source !== 'number') {
				const badStyle = findInReactTree(res.props.style, x => x.tintColor);

				if (badStyle?.tintColor) {
					delete badStyle.tintColor;
				}
			}
		}, true);
	});

	// @ts-expect-error - RN.Image has no 'render' method defined in its types
	Patcher.before(RN.Image, 'render', (_, [props]) => {
		const documentsPath = DCDFileManager.DocumentsDirPath;
		const identifier = '{__path__}';
		const { source } = props;

		// This is required because the bundle uid changes between versions, so it cannot be hardcoded in the manifest.
		// Therefore the string {__path__} is put in the manifest instead, and it is hydrated into the proper path below.
		if (typeof source === 'object' && source.uri && source.uri.includes(identifier)) {
			props.source = { ...props.source };
			props.source.uri = source.uri.replace(identifier, documentsPath);
		}
	});

	Patcher.before(Theming, 'updateTheme', (_, args) => {
		const appliedThemeId = themes.settings.get('applied', null);
		appliedThemeId && !args[0].includes(appliedThemeId) && (args[0] = `${appliedThemeId}-${args[0]}`);
	});

	const methods = Object.keys(ThemeBooleans)
	for (let i = 0; i < methods.length; i++) {
		const method = methods[i];

		Patcher.before(ThemeBooleans, method, (_, args) => {
			const appliedThemeId = themes.settings.get('applied', null);
			appliedThemeId && (args[0] = args[0].replace(`${appliedThemeId}-`, ''));
		})
	}
}

export function shutdown() {
	Patcher.unpatchAll();
}