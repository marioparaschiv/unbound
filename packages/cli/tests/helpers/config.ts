import { loadConfig, type ResolvedConfig } from '../../src/lib/config';

/**
 * @description Loads a test workspace's config, failing the test when it is invalid.
 * @param dir The workspace directory.
 * @returns The resolved config.
 */
export function loadWorkspace(dir: string): ResolvedConfig {
	const resolved = loadConfig(dir);

	if ('error' in resolved) {
		throw new Error(resolved.error);
	}

	return resolved;
}

export default loadWorkspace;
