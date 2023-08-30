import { BuiltIn } from '@typings/core/builtins';
import { createPatcher } from '@patcher';
import { ReactNative as RN } from '@metro/common';
import { getIDByName, getByID } from '@api/assets';
import { get, off, on } from '@api/storage';
import { Paths } from '@constants';

export const Packs = {
    default: {
        icon: getIDByName("img_nitro_star"),
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
}

const Patcher = createPatcher('iconpack');

export const data: BuiltIn['data'] = {
	id: 'modules.iconpack',
	default: true
};

function handler(originalSource: number, pack: keyof typeof Packs, args: any[]) {
    if (typeof originalSource !== 'number' || pack === 'default') return;

    const asset = getByID(originalSource);
    
    if (!asset) return;

    if (asset.iconPackPath) {
        args[0].source = {
            width: asset.width,
            height: asset.height,
            uri: `file://${asset.iconPackPath}`,
            scale: asset.iconPackScale
        };
    }
}

export function initialize() {
    // @ts-expect-error - RN.Image has no 'render' method defined on its types
    Patcher.before(RN.Image, 'render', (_, args) => {
        const pack = get('unbound', 'iconpack.name', 'default');
        const originalSource = args[0].source;
        const [, forceRender] = React.useState({});

        React.useLayoutEffect(() => {
            const payload = ({ store, key }) => {
                if (store === 'unbound' && key === 'iconpack.name') {
                    handler(originalSource, pack, args);
                    forceRender({});
                }
            }

            on('changed', payload);
            return () => off('changed', payload)
        }, [])
        
        handler(originalSource, pack, args);
    })
}

export function shutdown() {
	Patcher.unpatchAll();
}