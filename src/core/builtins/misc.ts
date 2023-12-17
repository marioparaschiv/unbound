import type { BuiltIn } from '@typings/core/builtins';
import { ReactNative as RN } from '@metro/common';
import { DCDFileManager } from '@api/storage';
import { findInReactTree } from '@utilities';
import { createPatcher } from '@patcher';
import { internalGetLazily } from '@metro/registry';
import { findByProps } from '@metro';
import themes from '@managers/themes';

const Patcher = createPatcher('misc');

export const data: BuiltIn['data'] = {
	id: 'modules.misc',
	default: true
};

const Icon = internalGetLazily('TableRowIcon', x => !('useCoachmark' in x));
const Theming = findByProps('updateTheme', { lazy: true });

export function initialize() {
	// Remove tintColor if the icon is a custom image (eg with a uri pointing to a badge)
	Patcher.after(Icon, 'TableRowIcon', (_, __, res) => {
		if (typeof res.props?.children?.type?.type?.render !== 'function') return;

		Patcher.after(res.props.children.type.type, 'render', (_, args, res) => {
			if (typeof args[0].source !== 'number') {
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
}

export function shutdown() {
	Patcher.unpatchAll();
}