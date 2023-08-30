import { Asset } from '@typings/api/assets';
import { findByProps } from '@metro';
import { createPatcher } from '@patcher';
import { createLogger } from '@logger';
import { Files, getStore, on } from './storage';
import { Packs } from '@core/builtins/icon-pack';
import { Paths } from '@constants';

export const assets = new Set<Asset>();
export const registry = findByProps('registerAsset');

const Logger = createLogger('Assets');
const Patcher = createPatcher('unbound-assets');

export function packExists<TAsync extends boolean>(
    store: ReturnType<typeof getStore>, 
    pack: string, 
    fs = false as TAsync
): TAsync extends true ? Promise<boolean> : boolean {
    if (fs) {
        const existsPromise = Files.fileExists(`${Files.DocumentsDirPath}/${Paths.packs.local}/${pack}`);

        return existsPromise.then(exists => {
            if (!exists) {
                store.set(
                    'iconpack.installed', 
                    store.get('iconpack.installed', ['default']).filter(x => x !== pack)
                )
            }

            return exists;
        })
    }

    return store.get('iconpack.installed', ['default'])
        .includes(pack) as TAsync extends true ? Promise<boolean> : boolean;
}

export function getRelativeAssetPath(asset: Asset, scale: number) {
    const path = asset.httpServerLocation.replace(/\/assets\/(.*)/, '$1');
    return `${path}/${asset.name}${scale > 1 ? `@${scale}x` : ''}.${asset.type}`
}

export async function applyIconPath(pack: keyof typeof Packs, asset: Asset) {
    asset.scales.sort((a, b) => b - a);

    for (const scale of asset.scales) {
        const exactPath = getRelativeAssetPath(asset, scale);
        const filePath = `${Files.DocumentsDirPath}/${Paths.packs.local}/${pack}/${exactPath}`;
    
        delete asset.iconPackPath;
        const fileExists = await Files.fileExists(filePath);
    
        if (fileExists) {
            asset.iconPackPath = filePath;
            asset.iconPackScale = scale;
            break;
        }
    }
}

function captureAssets(pack: keyof typeof Packs) {
    for (let id = 1; ; id++) {
		const asset: Asset | undefined = registry.getAssetByID(id);

		if (!asset) break;

        if (!assets.has(asset)) {
            Object.assign(asset, { id });
		    assets.add(asset);
        };

        applyIconPath(pack, asset);
	}
}

function initialize() {
    const store = getStore('unbound');
    
    const pack = store.get('iconpack.name', 'default');
    const installedPacks = store.get('iconpack.installed', ['default']);

    // Update iconpack.installed at startup
    for (const pack of installedPacks) {
        packExists(store, pack, true).then(fileExists => {
            if (!fileExists && pack !== 'default') {
                store.set(
                    'iconpack.installed', 
                    installedPacks.filter(p => p !== pack)
                )
            }
        })
    }

	Patcher.after(registry, 'registerAsset', (_, [asset]: [Asset], id: number) => {
        Object.assign(asset, { id });
		assets.add(asset);

        applyIconPath(pack, asset);
	});

	// Capture all assets that loaded before our patch
    captureAssets(pack);

    // Listen for changes to the iconpack.name
    on('changed', ({ store, key, value }) => {
        if (store === 'unbound' && key === 'iconpack.name') {
            captureAssets(value);
        }
    })
}

export function find(filter): Asset | null {
	return Object.values(assets).find(filter as any);
}

export function getByName(name: string, type: 'svg' | 'png' = 'png'): Asset | null {
	return [...assets].find(a => a.name === name && a.type === type);
}

export function getByID(id: number): Asset | null {
	return registry.getAssetByID(id);
}

export function getIDByName(name: string, type: 'svg' | 'png' = 'png'): number | null {
	return getByName(name, type)?.id;
}

export function getAll() {
	return [...assets];
}

export const Icons: Record<any, any> = new Proxy({}, {
	get: (_, name: string) => {
		return getIDByName(name);
	}
});

try {
	initialize();
} catch (e) {
	Logger.error('Failed to initialize assets:', e.message);
}

export default { assets, getByName, getByID, getIDByName };