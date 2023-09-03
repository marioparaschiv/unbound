import { getIDByName, getByID } from '@api/assets';
import { ReactNative as RN } from '@metro/common';
import { BuiltIn } from '@typings/core/builtins';
import { useSettingsStore } from '@api/storage';
import { createPatcher } from '@patcher';
import { Paths } from '@constants';

export const Packs = {
	default: {
		icon: getIDByName('img_nitro_star'),
		extension: null
	},
	plumpy: {
		icon: { uri: Paths.packs.raw + '/Plumpy/images/native/premium/perks/img_nitro_star@3x.png' },
		extension: '/Plumpy'
	},
	iconsax: {
		icon: { uri: Paths.packs.raw + '/Iconsax/images/native/premium/perks/img_nitro_star@3x.png' },
		extension: '/Iconsax'
	}
};

export type Pack = keyof typeof Packs;

const Patcher = createPatcher('iconpack');

export const data: BuiltIn['data'] = {
	id: 'modules.iconpack',
	default: true
};

export function initialize() {
	// @ts-expect-error - RN.Image has no 'render' method defined in its types
	Patcher.before(RN.Image, 'render', (_, [props]) => {
		const settings = useSettingsStore('unbound', ({ key }) => key === 'iconpack.name');
		const pack = settings.get('iconpack.name', 'default');
		const { source } = props;

		if (typeof source !== 'number' || pack === 'default') return;

		const asset = getByID(source);
		if (!asset) return;

		if (asset.iconPackPath) {
			props.source = {
				width: asset.width,
				height: asset.height,
				uri: `file://${asset.iconPackPath}`,
				scale: asset.iconPackScale
			};
		}
	});
}

export function shutdown() {
	Patcher.unpatchAll();
}