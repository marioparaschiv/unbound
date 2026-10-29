import { Project, ts } from 'ts-morph';

import type { ModuleFacts, ModuleRecord } from './types';
import type { ModuleContext, Value } from './values';

import { bindExports, isHookName, nameComponents } from './evidence';
import { walkFunction } from './interpret';
import { UNKNOWN } from './values';

// hermes-dec prints non-identifier member names raw (`r5.aria-busy`); real subtraction is always spaced.
const DASHED_MEMBER = /(\br\d+)\.([A-Za-z_$][\w$]*(?:-[\w$]+)+)/g;

/**
 * @description Creates the in-memory ts-morph project modules are parsed into.
 * @returns A project with no files and no type checking setup beyond plain JavaScript.
 */
export function createParser(): Project {
	return new Project({
		useInMemoryFileSystem: true,
		compilerOptions: { allowJs: true, noLib: true },
	});
}

/**
 * @description Parses one module's factory and extracts its components, their prop evidence and its re-exports.
 * The source file is removed from the project afterwards so memory stays bounded.
 * @param project The parser project.
 * @param record The module.
 * @returns The module's facts.
 */
export function extractModule(project: Project, record: ModuleRecord): ModuleFacts {
	const text = record.source.replace(DASHED_MEMBER, "$1['$2']");
	const source = project.createSourceFile(`/m${record.id}.js`, text, { overwrite: true });

	try {
		const file = source.compilerNode;
		const factory = factoryOf(file);

		if (!factory) {
			return { moduleId: record.id, components: [], hooks: [], reExports: [], passed: [] };
		}

		const ctx: ModuleContext = {
			moduleId: record.id,
			path: record.path,
			deps: record.deps,
			text,
			file,
			slots: new Map(),
			components: new Map(),
			exports: [],
			getters: [],
			staticOwners: [],
			displayNames: new Map(),
			passed: [],
		};
		const params: Value[] = [0, 1, 2, 3, 4, 5, 6].map((index) => ({ kind: 'param', index }));

		walkFunction(ctx, factory.body, params, UNKNOWN, void 0, void 0);

		const reExports = bindExports(ctx);

		const hooks = [...ctx.components.values()].filter(
			(component) => isHookName(component.name) && component.exportNames.length > 0,
		);

		return {
			moduleId: record.id,
			components: nameComponents(ctx),
			hooks,
			reExports,
			passed: ctx.passed,
		};
	} finally {
		project.removeSourceFile(source);
	}
}

function factoryOf(file: ts.SourceFile): ts.FunctionExpression | undefined {
	const [statement] = file.statements;

	if (!statement || !ts.isExpressionStatement(statement)) return;

	const { expression } = statement;

	if (!ts.isBinaryExpression(expression) || !ts.isFunctionExpression(expression.right)) return;

	return expression.right;
}

export default { createParser, extractModule };
