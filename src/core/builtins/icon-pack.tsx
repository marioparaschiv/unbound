import { BuiltIn } from '@typings/core/builtins';
import { createPatcher } from '@patcher';
import { ReactNative as RN } from '@metro/common';
import { getIDByName, getByID } from '@api/assets';
import { get, off, on } from '@api/storage';

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

function handler(originalSource: number, pack: keyof typeof Packs, args: any[]) {
    if (typeof originalSource !== 'number' || pack === 'default') return;

    const asset = getByID(originalSource);

    if (originalSource === 1205) console.log(asset);
    
    if (!asset) return;

    if (asset.iconPackPath) {
        args[0].source = { uri: `file://${asset.iconPackPath}`};
    }
}

export function initialize() {
    // @ts-expect-error - RN.Image has no 'render' method defined on its types
    Patcher.before(RN.Image, 'render', (_, args) => {
        const pack = get('unbound', 'iconpack.name', 'default');
        const originalSource = React.useMemo(() => args[0].source, []);
        const [, forceRender] = React.useState({});

        React.useLayoutEffect(() => {
            const payload = ({ store, key }) => {
                if (store === 'unbound' && key === 'iconpack.name') {
                    handler(originalSource, pack, args);
                    forceRender({});
                }
            }

            on('changed', payload)
            
            return () => off('changed', payload)
        }, [])
        
        handler(originalSource, pack, args);
    })
}

export function shutdown() {
	Patcher.unpatchAll();
}