import { blacklist } from '~/metro/state';

/** Whether a module's factory has run: `failed` when it threw or searches skip it before it ran. */
export type ModuleStatus = 'loaded' | 'unloaded' | 'failed';

const MAX_KEYS = 4;

// A loaded module's label never changes, and a search reads every label on each keystroke.
const labels = new Map<number, string>();

/**
 * @description Reports whether a module has loaded, without loading it.
 * @param id The module's id.
 * @returns The module's status.
 */
export function moduleStatus(id: number): ModuleStatus {
	const record = window.modules.get(id);

	if (record?.isInitialized && !record.hasError) {
		return 'loaded';
	}

	return record?.hasError || blacklist.has(id) ? 'failed' : 'unloaded';
}

/**
 * @description Names a loaded module by its file path, or else its first export keys. It reads only own keys.
 * @param id The module's id.
 * @returns The label, or `undefined` for a module that has not loaded or exports nothing nameable.
 */
export function moduleLabel(id: number): string | undefined {
	const known = labels.get(id);

	if (known !== undefined || moduleStatus(id) !== 'loaded') {
		return known || void 0;
	}

	const label = readLabel(window.modules.get(id)!);

	labels.set(id, label);

	return label || void 0;
}

/**
 * @description Filters modules by status, then by a query matching an id prefix or part of a label.
 * @param ids Every module id, in order.
 * @param query The search text; empty matches every module.
 * @param status The status to keep, or `all`.
 * @returns The matching ids, in order.
 */
export function searchModules(
	ids: readonly number[],
	query: string,
	status: ModuleStatus | 'all',
): number[] {
	const needle = query.trim().toLowerCase();
	const matches: number[] = [];

	for (let i = 0, len = ids.length; i < len; i++) {
		const id = ids[i];

		if (status !== 'all' && moduleStatus(id) !== status) {
			continue;
		}

		if (
			!needle ||
			String(id).startsWith(needle) ||
			moduleLabel(id)?.toLowerCase().includes(needle)
		) {
			matches.push(id);
		}
	}

	return matches;
}

/**
 * @description Reads a module's exports.
 * @param id The module's id.
 * @returns The exports, `undefined` before the module loads.
 */
export function moduleExports(id: number): MetroExport {
	return window.modules.get(id)?.publicModule.exports;
}

function readLabel(record: MetroModuleRecord): string {
	if (record.__filePath) {
		return record.__filePath;
	}

	try {
		const exports = record.publicModule.exports;

		if (typeof exports === 'function') {
			return Object.getOwnPropertyDescriptor(exports, 'name')?.value || '';
		}

		if (!exports || typeof exports !== 'object') {
			return '';
		}

		return Object.keys(exports)
			.filter((key) => key !== '__esModule')
			.slice(0, MAX_KEYS)
			.join(', ');
	} catch {
		// A proxy export can throw on enumeration; the row falls back to its id.
		return '';
	}
}
