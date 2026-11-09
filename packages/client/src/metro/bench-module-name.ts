const MAX_KEYS = 4;

/**
 * @description Names an initialized Discord module for a benchmark span: its file path, or for a library module
 * without one, its id and first export keys.
 * @param id The module's id.
 * @returns The span name.
 */
export function benchModuleName(id: number): string {
	const mdl = window.modules.get(id);

	if (mdl?.__filePath) {
		return `discord ${mdl.__filePath}`;
	}

	try {
		const exports = mdl?.publicModule?.exports;
		const keys =
			exports && typeof exports === 'object'
				? Object.keys(exports)
						.filter((key) => key !== '__esModule')
						.slice(0, MAX_KEYS)
				: [];
		const label =
			keys.join(',') || (typeof exports === 'function' && exports.name) || typeof exports;

		return `discord ${id} [${label}]`;
	} catch {
		// A Proxy export can throw on enumeration; the id alone still names the module.
		return `discord ${id}`;
	}
}
