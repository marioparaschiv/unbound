import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const packageRoots = new Map<string, string | undefined>();

/**
 * @description Finds the nearest directory holding a `package.json`, cached per lint process.
 * @param directory The absolute directory to start from.
 * @returns The package root, or `undefined` when no ancestor has a `package.json`.
 */
function packageRootOf(directory: string): string | undefined {
	if (packageRoots.has(directory)) {
		return packageRoots.get(directory);
	}

	const parent = dirname(directory);
	const root = existsSync(resolve(directory, 'package.json'))
		? directory
		: parent === directory
			? undefined
			: packageRootOf(parent);

	packageRoots.set(directory, root);

	return root;
}

export default packageRootOf;
