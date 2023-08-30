import { Asset } from '@typings/api/assets';
import { findByProps } from '@metro';
import { createPatcher } from '@patcher';
import { createLogger } from '@logger';
import { Files, getStore, on } from './storage';
import { Packs } from '@core/builtins/icon-pack';

export const assets = new Set<Asset>();
export const registry = findByProps('registerAsset');

const Logger = createLogger('Assets');
const Patcher = createPatcher('unbound-assets');

export function getRelativeAssetPath(asset: Asset) {
    const path = asset.httpServerLocation.replace(/\/assets\/(.*)/, '$1');
    const scale = asset.scales.some(x => x > 1) ? `@${Math.max(...asset.scales)}x` : '';

    return `${path}/${asset.name}${scale}.${asset.type}`
}

function captureAssets(pack: keyof typeof Packs) {
    for (let id = 1; ; id++) {
		const asset: Asset | undefined = registry.getAssetByID(id);

		if (!asset) break;

        const exactPath = getRelativeAssetPath(asset);
        const filePath = `${Files.DocumentsDirPath}/Unbound/Packs/${pack}/${exactPath}`;

        delete registry.getAssetByID(id).iconPackPath;
        Files.fileExists(filePath).then(fileExists => {
            if (fileExists) {
                registry.getAssetByID(id).iconPackPath = filePath;
            }
        });

        if (!assets.has(asset)) {
            Object.assign(asset, { id });
		    assets.add(asset);
        };
	}
}

function initialize() {
    const store = getStore('unbound');
    
    const pack = store.get('iconpack.name', 'default');
    const installedPacks = store.get('iconpack.installed', []);

    for (const pack of installedPacks) {
        Files.fileExists(`${Files.DocumentsDirPath}/Unbound/Packs/${pack}`).then(fileExists => {
            if (!fileExists) {
                store.set(
                    'iconpack.installed', 
                    installedPacks.filter(installedPack => installedPack !== pack)
                )
            }
        })
    }

	Patcher.after(registry, 'registerAsset', (_, [asset]: [Asset], id: number) => {
        const exactPath = getRelativeAssetPath(asset);
        const filePath = `${Files.DocumentsDirPath}/Unbound/Packs/${pack}/${exactPath}`;

        delete registry.getAssetByID(id).iconPackPath;
        Files.fileExists(filePath).then(fileExists => {
            if (fileExists) {
                registry.getAssetByID(id).iconPackPath = filePath;
            }
        })

		Object.assign(asset, { id });
		assets.add(asset);
	});

    captureAssets(pack);

	// Capture all assets that loaded before our patch
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