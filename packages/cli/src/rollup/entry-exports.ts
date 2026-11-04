import { parseSync, type ESTree } from 'rolldown/utils';
import type { Plugin } from 'rollup';

import {
	pluginDiagnostic,
	reportDiagnostics,
	type Diagnostic,
	type Severity,
} from './diagnostic.ts';

// The `ubd check` id this plugin reports under.
const CHECK = 'entry';

/** The exports the client reads from a plugin's entry, each with how many parameters it may take. */
export const LIFECYCLE_EXPORTS = {
	start: {
		kind: 'function',
		params: 1,
		signature: '(context: PluginContext) => void | Promise<void>',
	},
	stop: { kind: 'function', params: 0, signature: '() => void | Promise<void>' },
	SettingsPanel: { kind: 'component', params: 1, signature: 'a React component' },
	selfTest: { kind: 'function', params: 0, signature: '() => PluginSelfTestResult | Promise<…>' },
} as const;

export type LifecycleExport = keyof typeof LIFECYCLE_EXPORTS;

/** One problem in an entry, at its 1-based line and column. */
export type EntryProblem = { line: number; column: number; message: string };

/** What an entry module exports, and what is wrong with it. */
export type EntryReport = {
	names: Set<string>;
	errors: EntryProblem[];
	warnings: EntryProblem[];
};

const DEFAULT_FIX =
	'Fix: export start/stop as named functions (`export function start() {}`), or run `ubd migrate entry`.';
const OTHER_FIX = 'Fix: move handlers to src/actions.ts.';

type Binding = ESTree.Node | undefined;

function isLifecycle(name: string): name is LifecycleExport {
	return Object.hasOwn(LIFECYCLE_EXPORTS, name);
}

/**
 * @description Names the lifecycle export a misspelt name means: `Start`, `onStart` and `getSettingsPanel` all match.
 * @param name The exported name.
 * @returns The lifecycle export, or `undefined` when the name is not close to one.
 */
export function lifecycleTypo(name: string): LifecycleExport | undefined {
	const lower = name.toLowerCase();
	const bare = ['on', 'get', 'handle'].reduce(
		(rest, prefix) => (rest.startsWith(prefix) ? rest.slice(prefix.length) : rest),
		lower,
	);

	return Object.keys(LIFECYCLE_EXPORTS)
		.filter(isLifecycle)
		.find((lifecycle) => lifecycle !== name && lifecycle.toLowerCase() === bare);
}

function exportedName(node: ESTree.ModuleExportName): string {
	return node.type === 'Identifier' ? node.name : String(node.value);
}

// Top-level bindings, so `export { start }` is checked against the function it names.
function topLevelBindings(program: ESTree.Program): Map<string, Binding> {
	const bindings = new Map<string, Binding>();

	for (const statement of program.body) {
		const declaration =
			statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;

		if (!declaration) {
			continue;
		}

		if (
			(declaration.type === 'FunctionDeclaration' ||
				declaration.type === 'ClassDeclaration') &&
			declaration.id
		) {
			bindings.set(declaration.id.name, declaration);
		}

		if (declaration.type === 'VariableDeclaration') {
			for (const declarator of declaration.declarations) {
				if (declarator.id.type === 'Identifier') {
					bindings.set(declarator.id.name, declarator.init ?? void 0);
				}
			}
		}
	}

	return bindings;
}

type Callable = { params: number; async: boolean; generator: boolean; component: boolean };

// `undefined` when the value is not visible here: an import, a call, a member.
function callableOf(
	node: Binding,
	bindings: Map<string, Binding>,
	seen = new Set<string>(),
): Callable | 'not-callable' | undefined {
	if (!node) return;

	switch (node.type) {
		case 'FunctionDeclaration':
		case 'FunctionExpression':
		case 'ArrowFunctionExpression':
			return {
				params: node.params.length,
				async: node.async,
				generator: node.generator,
				component: false,
			};
		case 'ClassDeclaration':
		case 'ClassExpression':
			return { params: 1, async: false, generator: false, component: true };
		case 'Identifier':
			if (seen.has(node.name) || !bindings.has(node.name)) return;

			seen.add(node.name);

			return callableOf(bindings.get(node.name), bindings, seen);
		case 'Literal':
		case 'TemplateLiteral':
		case 'ObjectExpression':
		case 'ArrayExpression':
		case 'JSXElement':
		case 'JSXFragment':
			return 'not-callable';
		default:
	}
}

function signatureProblem(
	name: LifecycleExport,
	callable: Callable | 'not-callable' | undefined,
): string | undefined {
	const { kind, params, signature } = LIFECYCLE_EXPORTS[name];
	const expected = `\`${name}\` must be ${kind === 'component' ? signature : `a function ${signature}`}`;

	if (!callable) return;

	if (callable === 'not-callable') {
		return `${expected}, not a value.`;
	}

	if (callable.generator) {
		return `${expected}, not a generator.`;
	}

	if (kind === 'component' && callable.async) {
		return `${expected}; a component cannot be async. Fix: load data in a hook.`;
	}

	if (!callable.component && callable.params > params) {
		return `${expected}; it takes ${callable.params} parameters, and Unbound passes ${params}.`;
	}
}

/**
 * @description Reads a plugin entry's exports on the oxc AST and checks them against the lifecycle the client reads.
 * @param code The entry's source.
 * @param id The entry's path; its extension picks the syntax.
 * @returns The exported names, the errors that fail the build, and the warnings.
 */
export function readEntryExports(code: string, id: string): EntryReport {
	const { program } = parseSync(id, code);
	const bindings = topLevelBindings(program);
	const report: EntryReport = { names: new Set(), errors: [], warnings: [] };
	const starts = [0];

	for (let index = 0; index < code.length; index++) {
		if (code[index] === '\n') {
			starts.push(index + 1);
		}
	}

	function at(offset: number, message: string): EntryProblem {
		const line = starts.findLastIndex((start) => start <= offset);

		return { line: line + 1, column: offset - (starts[line] ?? 0) + 1, message };
	}

	function check(name: string, value: Binding, offset: number) {
		report.names.add(name);

		if (isLifecycle(name)) {
			const problem = signatureProblem(name, callableOf(value, bindings));

			if (problem) {
				report.errors.push(at(offset, problem));
			}

			return;
		}

		const typo = lifecycleTypo(name);

		if (typo) {
			report.errors.push(
				at(offset, `\`${name}\` is not a lifecycle export. Fix: rename it to \`${typo}\`.`),
			);

			return;
		}

		report.warnings.push(
			at(
				offset,
				`\`${name}\` is exported, but Unbound reads only start, stop and SettingsPanel. ${OTHER_FIX}`,
			),
		);
	}

	for (const statement of program.body) {
		if (statement.type === 'ExportDefaultDeclaration') {
			report.errors.push(
				at(statement.start, `The entry has a default export. ${DEFAULT_FIX}`),
			);
		}

		if (statement.type === 'ExportAllDeclaration' && statement.exportKind !== 'type') {
			report.warnings.push(
				at(
					statement.start,
					`\`export *\` from '${statement.source.value}' is not read. ${OTHER_FIX}`,
				),
			);
		}

		if (statement.type !== 'ExportNamedDeclaration' || statement.exportKind === 'type') {
			continue;
		}

		const { declaration } = statement;

		if (
			(declaration?.type === 'FunctionDeclaration' ||
				declaration?.type === 'ClassDeclaration') &&
			declaration.id
		) {
			check(declaration.id.name, declaration, declaration.id.start);
		}

		if (declaration?.type === 'VariableDeclaration') {
			for (const declarator of declaration.declarations) {
				if (declarator.id.type === 'Identifier') {
					check(declarator.id.name, declarator.init ?? void 0, declarator.id.start);
				}
			}
		}

		for (const specifier of statement.specifiers) {
			if (specifier.exportKind === 'type') {
				continue;
			}

			const name = exportedName(specifier.exported);

			if (name === 'default') {
				report.errors.push(
					at(specifier.start, `The entry exports \`default\`. ${DEFAULT_FIX}`),
				);
				continue;
			}

			const local = statement.source ? void 0 : specifier.local;

			check(name, local?.type === 'Identifier' ? local : void 0, specifier.exported.start);
		}
	}

	return report;
}

// A problem's message carries its fix after ` Fix: `; the diagnostic keeps them apart.
function toDiagnostic(
	pluginRoot: string,
	file: string,
	severity: Severity,
	{ line, column, message }: EntryProblem,
): Diagnostic {
	const [text = message, fix] = message.split(' Fix: ');

	return pluginDiagnostic(CHECK, pluginRoot, {
		file,
		line,
		column,
		severity,
		message: text,
		fix,
	});
}

/**
 * @description Fails the build on a default export, a misspelt lifecycle name or a wrong signature in the
 * plugin's entry, and warns on any other export.
 * @param entry The entry module's path.
 * @param pluginRoot The plugin's directory, which diagnostics name files relative to.
 * @returns The rollup plugin. It reads TypeScript, so it goes before the TypeScript transform.
 */
export function entryExports(entry: string, pluginRoot: string): Plugin {
	return {
		name: 'unbound-entry-exports',
		transform(code, id) {
			if (id !== entry) return null;

			const { errors, warnings } = readEntryExports(code, id);

			reportDiagnostics(this, [
				...errors.map((problem) => toDiagnostic(pluginRoot, id, 'error', problem)),
				...warnings.map((problem) => toDiagnostic(pluginRoot, id, 'warning', problem)),
			]);

			return null;
		},
	};
}

export default { entryExports, lifecycleTypo, readEntryExports };
