import { getNativeBridge } from '~/native/bridge';

/** The app extensions a sideloaded install ships, by bundle name, with the name `/debug` shows for each. */
const EXTENSIONS: Record<string, string> = { Share: 'Share', OpenInDiscord: 'Safari' };

const STORE_SOURCES = /app ?store|testflight|trollstore/i;

/**
 * @description Names the extensions a sideloaded iOS install is missing from its `PlugIns` folder, which happens when a
 * sideloader strips them.
 * @param appSource Where the app came from, as the loader reports it.
 * @returns The missing extensions, or `undefined` off iOS, for store installs, or when the folder cannot be read.
 */
export function missingExtensions(appSource: string): string[] | undefined {
	const objc = getNativeBridge()?.objc;

	if (!objc || STORE_SOURCES.test(appSource)) return undefined;

	const bundleClass = objc.getClass('NSBundle');
	const managerClass = objc.getClass('NSFileManager');
	const bundle = bundleClass && objc.call(bundleClass, 'mainBundle');
	const path = bundle && objc.call(bundle as never, 'builtInPlugInsPath');
	const manager = managerClass && objc.call(managerClass, 'defaultManager');

	if (typeof path !== 'string' || !manager) return undefined;

	return Object.entries(EXTENSIONS)
		.filter(
			([bundleName]) =>
				objc.call(manager as never, 'fileExistsAtPath:', `${path}/${bundleName}.appex`) !==
				true,
		)
		.map(([, label]) => label);
}

export default missingExtensions;
