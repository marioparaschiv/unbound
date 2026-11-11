import { checkPredicate, type PredicateProblem } from './predicate-scope.ts';
import { parseSync, type ESTree } from './rolldown-utils.ts';

/** A 1-based line and column in a source file. */
export type Location = { line: number; column: number };

/** A predicate written in settings.ts, lifted by its setting's key and option. */
export type LiftedPredicate = {
	path: string;
	option: 'visibleWhen' | 'disabledWhen';
	source: string;
};

/** What the build reads from settings.ts's syntax: where each property is, and its predicates. */
export type SettingsSource = {
	/** Each dot-separated property path's offset; `''` is the default export. */
	offsets: Map<string, number>;
	predicates: LiftedPredicate[];
	/** Predicates that cannot be lifted, by path. */
	problems: (PredicateProblem & { path: string })[];
	starts: number[];
};

const CONDITIONS = new Set(['visibleWhen', 'disabledWhen']);

/**
 * @description Lists the offset each line of a source starts at, for {@link toLocation}.
 * @param source The source.
 * @returns The offsets.
 */
export function lineStarts(source: string): number[] {
	const starts = [0];

	for (let i = 0, len = source.length; i < len; i++) {
		if (source[i] === '\n') {
			starts.push(i + 1);
		}
	}

	return starts;
}

/**
 * @description Turns an offset into a line and column.
 * @param starts The source's {@link lineStarts}.
 * @param offset The offset.
 * @returns The 1-based line and column.
 */
export function toLocation(starts: number[], offset: number): Location {
	const line = Math.max(
		0,
		starts.findLastIndex((start) => start <= offset),
	);

	return { line: line + 1, column: offset - (starts[line] ?? 0) + 1 };
}

function keyName(property: ESTree.ObjectPropertyKind): string | undefined {
	if (property.type !== 'Property') return;

	if (property.key.type === 'Identifier') {
		return property.key.name;
	}

	return property.key.type === 'Literal' && typeof property.key.value === 'string'
		? property.key.value
		: undefined;
}

// `x as T`, `x satisfies T`, `x!` and `(x)` are `x` at runtime.
function unwrap(node: ESTree.Expression): ESTree.Expression {
	let current = node;

	while (
		current.type === 'TSAsExpression' ||
		current.type === 'TSSatisfiesExpression' ||
		current.type === 'TSNonNullExpression' ||
		current.type === 'ParenthesizedExpression'
	) {
		current = current.expression;
	}

	return current;
}

function objectArgument(node: ESTree.Node | null | undefined, index: number) {
	const argument = node?.type === 'CallExpression' ? node.arguments[index] : undefined;

	return argument?.type === 'ObjectExpression' ? argument : undefined;
}

// `defineSettings({ ... })`, written inline or bound to a top-level const the file default-exports.
function rootObject(
	program: ESTree.Program,
): { start: number; object?: ESTree.ObjectExpression } | undefined {
	const exported = program.body.find((node) => node.type === 'ExportDefaultDeclaration');

	if (!exported) return;

	let call: ESTree.Node | null | undefined = exported.declaration;

	if (call.type === 'Identifier') {
		const name = call.name;

		call = program.body
			.flatMap((node) => (node.type === 'VariableDeclaration' ? node.declarations : []))
			.find((node) => node.id.type === 'Identifier' && node.id.name === name)?.init;
	}

	return { start: exported.start, object: objectArgument(call, 0) };
}

/**
 * @description Reads settings.ts's syntax: where each property is written, and the source of each predicate, checked to be liftable.
 * @param fileName The schema file's name, for the parser.
 * @param source The schema file's source.
 * @returns The offsets, predicates and problems.
 */
export function readSettingsSource(fileName: string, source: string): SettingsSource {
	const { program } = parseSync(fileName, source, { lang: 'ts' });
	const result: SettingsSource = {
		offsets: new Map(),
		predicates: [],
		problems: [],
		starts: lineStarts(source),
	};
	const root = rootObject(program);

	if (!root) {
		return result;
	}

	result.offsets.set('', root.start);

	function visitOptions(options: ESTree.ObjectExpression | undefined, path: string) {
		for (const property of options?.properties ?? []) {
			const option = keyName(property);

			if (property.type !== 'Property' || !option || !CONDITIONS.has(option)) {
				continue;
			}

			const fn = unwrap(property.value);

			// A key names a boolean setting; the schema check reads it from the evaluated JSON.
			if (fn.type === 'Literal' || fn.type === 'TemplateLiteral') {
				continue;
			}

			const problems = checkPredicate(fn);

			result.offsets.set(`${path}.${option}`, property.start);
			result.problems.push(
				...problems.map((problem) => ({ ...problem, path: `${path}.${option}` })),
			);

			if (!problems.length) {
				result.predicates.push({
					path,
					option: option === 'visibleWhen' ? 'visibleWhen' : 'disabledWhen',
					source: source.slice(fn.start, fn.end),
				});
			}
		}
	}

	function visit(object: ESTree.ObjectExpression | undefined, prefix: string) {
		for (const property of object?.properties ?? []) {
			const key = keyName(property);

			if (!key || property.type !== 'Property') {
				continue;
			}

			const path = prefix ? `${prefix}.${key}` : key;

			result.offsets.set(path, property.start);
			visitOptions(objectArgument(property.value, 0), path);

			// A section's settings are its second argument.
			if (!prefix) {
				visit(objectArgument(property.value, 1), path);
			}
		}
	}

	visit(root.object, '');

	return result;
}

/**
 * @description Reads the named exports of a plugin's `src/actions.ts`, and which of them are functions: a function declaration, or a const bound to a function.
 * @param fileName The file's name, for the parser.
 * @param source The file's source.
 * @returns Each export's name, and whether it is a function.
 */
export function readActionExports(fileName: string, source: string): Map<string, boolean> {
	const { program } = parseSync(fileName, source);
	const exports = new Map<string, boolean>();

	for (const node of program.body) {
		if (node.type !== 'ExportNamedDeclaration' || node.exportKind === 'type') {
			continue;
		}

		const { declaration } = node;

		if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
			exports.set(declaration.id.name, true);
		}

		if (declaration?.type === 'VariableDeclaration') {
			for (const declarator of declaration.declarations) {
				const init = declarator.init ? unwrap(declarator.init) : undefined;

				if (declarator.id.type === 'Identifier') {
					exports.set(
						declarator.id.name,
						init?.type === 'ArrowFunctionExpression' ||
							init?.type === 'FunctionExpression',
					);
				}
			}
		}

		// A re-export's value is not in this file, so it cannot be checked to be a function.
		for (const spec of node.specifiers) {
			const name =
				spec.exported.type === 'Identifier'
					? spec.exported.name
					: String(spec.exported.value);

			if (!exports.has(name)) {
				exports.set(name, false);
			}
		}
	}

	return exports;
}

export default { lineStarts, readActionExports, readSettingsSource, toLocation };
