import { BuiltIn } from '@typings/core/builtins';
import { createPatcher } from '@patcher';
import { ReactNative as RN } from '@metro/common';
import { getIDByName, getByID } from '@api/assets';
import { Files, useSettingsStore } from '@api/storage';

export const paths = {
    base: 'https://github.com/acquitelol/rosiecord/tree/master/Packs',
    raw: 'https://raw.githubusercontent.com/acquitelol/rosiecord/master/Packs',
}

export const Packs = {
    default: {
        icon: getIDByName("img_nitro_star"),
        extension: null
    },
    plumpy: {
        icon: { uri: paths.raw + '/Plumpy/images/native/premium/perks/img_nitro_star@3x.png' },
        extension: '/Plumpy'
    },
    iconsax: {
        icon: { uri: paths.raw + '/Iconsax/images/native/premium/perks/img_nitro_star@3x.png' },
        extension: '/Iconsax'
    }
}

const Patcher = createPatcher('iconpack');

export const data: BuiltIn['data'] = {
	id: 'modules.iconpack',
	default: true
};

export function initialize() {
    // @ts-expect-error - RN.Image has no 'render' method defined on its types
    Patcher.before(RN.Image, 'render', (_, args) => {
        const [selected, setSelected] = React.useState(args[0].source);
        const settings = useSettingsStore('unbound');

        const pack: keyof typeof Packs = settings.get('iconpack.name', 'default');
        const installedPacks = settings.get('iconpack.installed', []);

        if (typeof args[0].source !== 'number' || pack === 'default' || !installedPacks.includes(pack)) return;

        const asset = getByID(args[0].source);

        const path = asset.httpServerLocation.replace(/\/assets\/(.*)/, '$1');
        const scale = asset.scales.some(x => x > 1) ? `@${Math.max(...asset.scales)}x` : '';

        const exactPath = `${path}/${asset.name}${scale}.${asset.type}`
        const filePath = `${Files.DocumentsDirPath}/Unbound/Packs/${pack}/${exactPath}`;

        Files.fileExists(filePath).then(res => res && setSelected({ uri: `file://${filePath}` }));
        args[0].source = selected;
    })
}

export function shutdown() {
	Patcher.unpatchAll();
}