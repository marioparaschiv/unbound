import { transformSync, type ESTree } from 'rolldown/utils';
import { dirname, join, relative } from 'node:path';
import { parseAst } from 'rolldown/parseAst';
import { createRequire } from 'node:module';
import { RolldownMagicString } from 'rolldown';
import type { Plugin } from 'rolldown';

type Program = ESTree.Program;
type Statement = ESTree.Program['body'][number];

type Edit = { at: number; text: string; replace?: number };

// Oxc names inner registrations `A$memo` / `A$forwardRef` and anonymous defaults `%default%`.
const BINDING_NAME = /^[A-Za-z_]\w*$/;
const SIGNATURE_NAME = /^_s\d*$/;
const WRAPPER_NAMES = new Set(['memo', 'forwardRef']);

/**
 * @description Applies React Fast Refresh's transform (oxc's `jsx.refresh`), then rebinds every registered
 * component to a stable function from the client's hot runtime, so a patch reaches elements Discord made.
 * @param root The directory module ids are made relative to, matching rolldown's dev-mode ids.
 * @param runtime The import specifier of the hot runtime module.
 * @returns A rolldown plugin for dev builds.
 */
export default function refresh(root: string, runtime: string): Plugin {
	return {
		name: 'refresh',
		transform: {
			filter: {
				id: { include: /\/src\/.*\.[jt]sx?$/, exclude: /node_modules|\/src\/lib\/hot\// },
			},
			handler(source, id) {
				return { code: transformModule(source, id, root, runtime), moduleType: 'js' };
			},
		},
	};
}

/**
 * @description Compiles one source module for hot refresh: JSX and TypeScript to JavaScript, with its
 * components registered and rebound to their stable forwarders.
 * @param source The module's source.
 * @param id The module's absolute path.
 * @param root The directory module ids are made relative to.
 * @param runtime The import specifier of the hot runtime module.
 * @returns The compiled JavaScript.
 */
export function transformModule(source: string, id: string, root: string, runtime: string): string {
	// Classic `React.createElement` resolves to Discord's React. The automatic runtime would bundle
	// `react/jsx-runtime`, whose development build calls dispatcher methods production React lacks.
	const transformed = transformSync(id, source, { jsx: { runtime: 'classic', refresh: true } });

	if (transformed.errors.length) {
		throw new Error(transformed.errors.map((error) => error.message).join('\n'));
	}

	const code = transformed.code;

	if (!code.includes('$RefreshReg$') && !code.includes('$RefreshSig$')) {
		return code;
	}

	const module = relative(root, id);
	const program = parseAst(code, { lang: 'js' }, id);
	const registrations = findRegistrations(program);
	const bound = new Set(registrations.keys());
	const edits: Edit[] = [{ at: 0, text: prelude(runtime, module) }];

	for (const statement of program.body) {
		const declaration = declarationOf(statement);

		if (declaration?.type !== 'VariableDeclaration' || declaration.kind !== 'const') {
			continue;
		}

		if (declaration.declarations.some(({ id }) => isBound(id, bound))) {
			edits.push({ at: declaration.start, text: 'let', replace: 'const'.length });
		}
	}

	// Rebind right after oxc captures the component (`_c = Name;`), before anything else in the
	// module reads it: `export default Name` copies the value rather than the binding.
	for (const statement of program.body) {
		const name = capturedName(statement, registrations);

		if (name) {
			const key = JSON.stringify(`${module} ${name}`);

			edits.push({ at: statement.end, text: `\n${name} = __hotCanonical(${name}, ${key});` });
		}
	}

	if (exportsOnlyComponents(program, bound)) {
		edits.push({ at: code.length, text: '\nimport.meta.hot.accept();\n' });
	}

	return applyEdits(code, edits);
}

/**
 * @description Bundles `react-refresh/runtime`'s development build, inlining `process.env.NODE_ENV`
 * there alone so React's own entries stay on their production builds.
 * @param root The package directory `react-refresh` resolves from.
 * @returns A rolldown plugin for every build.
 */
export function refreshRuntime(root: string): Plugin {
	const entry = createRequire(join(root, 'package.json')).resolve('react-refresh/runtime');
	const development = join(dirname(entry), 'cjs', 'react-refresh-runtime.development.js');

	return {
		name: 'refresh-runtime',
		resolveId(source) {
			return source === 'react-refresh/runtime' ? development : null;
		},
		transform(code, id) {
			if (id !== development) return null;

			const runtime = new RolldownMagicString(code).replaceAll(
				'process.env.NODE_ENV',
				'"development"',
			);

			return {
				code: runtime.toString(),
				map: runtime.generateMap({ hires: true }).toString(),
			};
		},
	};
}

function prelude(runtime: string, module: string) {
	return [
		`import { register as __hotRegister, canonical as __hotCanonical, createSignatureFunctionForTransform as $RefreshSig$ } from '${runtime}';`,
		`var $RefreshReg$ = (type, name) => __hotRegister(type, ${JSON.stringify(module)} + ' ' + name);`,
		'',
	].join('\n');
}

function findRegistrations(program: Program) {
	const bindings = componentBindings(program);
	const found = new Map<string, string>();

	for (const statement of program.body) {
		if (statement.type !== 'ExpressionStatement') {
			continue;
		}

		const call = statement.expression;

		if (call.type !== 'CallExpression' || call.callee.type !== 'Identifier') {
			continue;
		}

		const [handle, name] = call.arguments;

		if (
			call.callee.name !== '$RefreshReg$' ||
			handle?.type !== 'Identifier' ||
			name?.type !== 'Literal'
		) {
			continue;
		}

		const binding = String(name.value);

		if (BINDING_NAME.test(binding) && bindings.has(binding)) {
			found.set(binding, handle.name);
		}
	}

	return found;
}

function componentBindings(program: Program) {
	const bindings = new Set<string>();

	for (const statement of program.body) {
		const declaration = declarationOf(statement);

		if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
			bindings.add(declaration.id.name);
		}

		if (declaration?.type !== 'VariableDeclaration') {
			continue;
		}

		for (const { id, init } of declaration.declarations) {
			if (id.type === 'Identifier' && init && isRebindableComponent(init)) {
				bindings.add(id.name);
			}
		}
	}

	return bindings;
}

function isRebindableComponent(node: ESTree.Expression): boolean {
	if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
		return true;
	}

	if (node.type === 'AssignmentExpression') {
		return isRebindableComponent(node.right);
	}

	if (node.type !== 'CallExpression') {
		return false;
	}

	const callee = node.callee.type === 'MemberExpression' ? node.callee.property : node.callee;
	const name = callee.type === 'Identifier' ? callee.name : '';
	const [first] = node.arguments;

	// Oxc wraps a component with hooks in its signature function: `_s(memo(...), "hash")`.
	if (SIGNATURE_NAME.test(name)) {
		return first !== void 0 && first.type !== 'SpreadElement' && isRebindableComponent(first);
	}

	return WRAPPER_NAMES.has(name);
}

function capturedName(statement: Statement, registrations: Map<string, string>) {
	if (statement.type !== 'ExpressionStatement') return;

	const assignment = statement.expression;

	if (
		assignment.type !== 'AssignmentExpression' ||
		assignment.left.type !== 'Identifier' ||
		assignment.right.type !== 'Identifier'
	) {
		return;
	}

	const name = assignment.right.name;

	return registrations.get(name) === assignment.left.name ? name : void 0;
}

function declarationOf(statement: Statement) {
	if (
		statement.type === 'ExportNamedDeclaration' ||
		statement.type === 'ExportDefaultDeclaration'
	) {
		return statement.declaration;
	}

	return statement;
}

function isBound(id: ESTree.BindingPattern, bound: Set<string>) {
	return id.type === 'Identifier' && bound.has(id.name);
}

function exportsOnlyComponents(program: Program, components: Set<string>) {
	const names = program.body.flatMap(exportedNames);

	return names.length > 0 && names.every((name) => name !== void 0 && components.has(name));
}

function exportedNames(statement: Statement): (string | undefined)[] {
	if (statement.type === 'ExportAllDeclaration') {
		return [void 0];
	}

	if (statement.type === 'ExportDefaultDeclaration') {
		const value = statement.declaration;

		if (value.type === 'Identifier') {
			return [value.name];
		}

		return [value.type === 'FunctionDeclaration' ? value.id?.name : void 0];
	}

	if (statement.type !== 'ExportNamedDeclaration') {
		return [];
	}

	if (statement.source) {
		return [void 0];
	}

	const declaration = statement.declaration;

	if (!declaration) {
		return statement.specifiers.map(({ local }) =>
			local.type === 'Identifier' ? local.name : void 0,
		);
	}

	if (declaration.type === 'FunctionDeclaration') {
		return [declaration.id?.name];
	}

	if (declaration.type !== 'VariableDeclaration') {
		return [void 0];
	}

	return declaration.declarations.map(({ id }) => (id.type === 'Identifier' ? id.name : void 0));
}

function applyEdits(code: string, edits: Edit[]) {
	let result = code;

	for (const { at, text, replace = 0 } of edits.toSorted((a, b) => b.at - a.at)) {
		result = result.slice(0, at) + text + result.slice(at + replace);
	}

	return result;
}
