import type { ModuleRecord, ModuleSummary } from './types';

import { EXPORTS, FACTORY_ARITY, paramName } from './metro-params';
import intern from './intern';

const FACTORY_PARAMS = Array.from({ length: FACTORY_ARITY }, (_, index) => paramName(index));
const TOP_LEVEL_ASSIGN = /^ {4}(r\d+) = (.*);$/;
const FACTORY_START = new RegExp(
	String.raw`^ {4}(r\d+) = function\(${FACTORY_PARAMS.join(', ')}\) \{`,
);
const FACTORY_END = '    };';
const DEFINE_CALL = /^ {4}r\d+ = (r\d+)\.bind\(r\d+\)\((r\d+), (r\d+), (r\d+)\);$/;
const PATH = /\.fileFinishedImporting;\n\s*r\d+ = '((?:[^'\\]|\\.)*)';/;
const EXPORTS_REGISTER = new RegExp(String.raw`^ {8,}(r\d+) = ${paramName(EXPORTS)};$`, 'gm');
const EXPORT_GETTER = /Original name: get ([\w$]+),/g;

type Factory = {
	register: string;
	lines: string[];
};

/**
 * @description Splits the decompiled bundle into metro modules. The bundle's top-level function registers each
 * module with `__d(factory, id, deps)`, so the splitter tracks the top-level registers holding `__d`, numbers
 * and arrays, and emits a module when the define call names them.
 * @param lines The bundle's lines, in order.
 * @yields One record per module, in bundle order.
 */
export async function* splitModules(
	lines: Iterable<string> | AsyncIterable<string>,
): AsyncGenerator<ModuleRecord> {
	const numbers = new Map<string, number>();
	const arrays = new Map<string, number[]>();
	const defines = new Set<string>();

	let open: Factory | undefined;
	let closed: Factory | undefined;

	for await (const line of lines) {
		if (open) {
			open.lines.push(line);

			if (line === FACTORY_END) {
				closed = open;
				open = undefined;
			}

			continue;
		}

		const start = FACTORY_START.exec(line);

		if (start) {
			open = { register: start[1]!, lines: [line] };

			continue;
		}

		const define = DEFINE_CALL.exec(line);

		if (define && closed && defines.has(define[1]!) && closed.register === define[2]) {
			const id = numbers.get(define[3]!);
			const deps = arrays.get(define[4]!);

			if (id !== undefined && deps) {
				const source = closed.lines.join('\n');
				const path = PATH.exec(source)?.[1];

				yield { id, path: path === undefined ? undefined : intern(path), deps, source };
			}

			closed = undefined;
		}

		const assign = TOP_LEVEL_ASSIGN.exec(line);

		if (!assign) {
			continue;
		}

		const register = assign[1]!;
		const value = assign[2]!;

		track(numbers, register, /^\d+$/.test(value) ? Number(value) : undefined);
		track(arrays, register, parseArray(value));

		if (/^r\d+\.__d$/.test(value)) {
			defines.add(register);
		} else {
			defines.delete(register);
		}
	}
}

function track<T>(map: Map<string, T>, register: string, value: T | undefined) {
	if (value === undefined) {
		map.delete(register);
	} else {
		map.set(register, value);
	}
}

function parseArray(value: string): number[] | undefined {
	if (value === 'new Array(0)' || value === '[]') {
		return [];
	}

	if (!/^\[\d+(, \d+)*\]$/.test(value)) return;

	return value.slice(1, -1).split(', ').map(Number);
}

/**
 * @description Cheap text test for whether a module may define a React component, run before any parse.
 * @param source The module's factory text.
 * @returns True when the module names a PascalCase function and reads a JSX factory.
 */
export function isComponentCandidate(source: string): boolean {
	return (
		/Original name: [A-Z]/.test(source) &&
		/\.(jsxs?|createElement|forwardRef|memo);$/m.test(source)
	);
}

/**
 * @description Builds the light index entry kept for every module.
 * @param module The module to summarize.
 * @returns The module's id, path and the names it assigns onto its exports object or defines getters for.
 */
export function summarize(module: ModuleRecord): ModuleSummary {
	const names = new Set<string>();

	for (const [, register] of module.source.matchAll(EXPORTS_REGISTER)) {
		const assign = new RegExp(`^ {8,}${register}\\['([^']+)'\\] = `, 'gm');

		for (const [, name] of module.source.matchAll(assign)) {
			names.add(intern(name!));
		}
	}

	for (const [, name] of module.source.matchAll(EXPORT_GETTER)) {
		names.add(intern(name!));
	}

	return { id: module.id, path: module.path, exportNames: [...names].sort() };
}

export default { splitModules, isComponentCandidate, summarize };
