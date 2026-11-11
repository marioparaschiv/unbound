import MagicString from 'magic-string';

import { parseSync, type ESTree } from '~/rollup/rolldown-utils';

/** What migrating one entry did: the new source, whether it changed, and what it could not migrate. */
export type EntryMigration = { code: string; changed: boolean; problems: string[] };

type Comment = { start: number; end: number };

type Member = { comments: string[]; specifier?: string; declaration?: string };

// The old object's keys that name a different export now.
const RENAMED: Record<string, string> = { getSettingsPanel: 'SettingsPanel' };

function keyName(property: ESTree.ObjectProperty): string | undefined {
	if (property.computed) return;

	if (property.key.type === 'Identifier') {
		return property.key.name;
	}

	if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
		return property.key.value;
	}
}

function topLevelNames(program: ESTree.Program): Set<string> {
	const names = new Set<string>();

	for (const statement of program.body) {
		const declaration =
			statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;

		if (declaration?.type === 'ImportDeclaration') {
			for (const specifier of declaration.specifiers) names.add(specifier.local.name);
		}

		if (
			(declaration?.type === 'FunctionDeclaration' ||
				declaration?.type === 'ClassDeclaration') &&
			declaration.id
		) {
			names.add(declaration.id.name);
		}

		if (declaration?.type === 'VariableDeclaration') {
			for (const declarator of declaration.declarations) {
				if (declarator.id.type === 'Identifier') {
					names.add(declarator.id.name);
				}
			}
		}
	}

	return names;
}

// Top-level `function name() {}` statements not yet exported, which take an `export` keyword in place.
function plainFunctions(program: ESTree.Program): Map<string, ESTree.Function> {
	const functions = new Map<string, ESTree.Function>();

	for (const statement of program.body) {
		if (statement.type === 'FunctionDeclaration' && statement.id) {
			functions.set(statement.id.name, statement);
		}
	}

	return functions;
}

// `() => <Panel />`: a panel getter that renders one component with no props, which is that component.
function renderedComponent(value: ESTree.Expression): string | undefined {
	if (value.type !== 'ArrowFunctionExpression' && value.type !== 'FunctionExpression') return;

	if (value.params.length) return;

	const block = value.body?.type === 'BlockStatement' ? value.body.body : undefined;
	const only = block?.length === 1 ? block[0] : undefined;
	const body = block
		? only?.type === 'ReturnStatement'
			? only.argument
			: undefined
		: value.body;

	if (body?.type !== 'JSXElement') return;

	const { name, attributes } = body.openingElement;

	if (name.type !== 'JSXIdentifier' || attributes.length || body.children.length) return;

	return name.name;
}

// The members sat one level in, inside the object; the function they become sits at the top level.
function dedent(text: string, indent: string): string {
	return text
		.split('\n')
		.map((line, index) => (index && line.startsWith(indent) ? line.slice(indent.length) : line))
		.join('\n');
}

function indentAt(code: string, offset: number): string {
	const lineStart = code.lastIndexOf('\n', offset - 1) + 1;
	let end = lineStart;

	while (end < offset && (code[end] === '\t' || code[end] === ' ')) end++;

	return code.slice(lineStart, end);
}

function functionSource(
	code: string,
	name: string,
	value: ESTree.Function | ESTree.ArrowFunctionExpression,
	indent: string,
) {
	const slice = (node: { start: number; end: number } | null | undefined) =>
		node ? code.slice(node.start, node.end) : '';
	const first = value.params[0];
	const last = value.params.at(-1);
	const params = first && last ? code.slice(first.start, last.end) : '';
	const body = value.body;
	const block =
		body?.type === 'BlockStatement'
			? dedent(slice(body), indent)
			: `{\n\treturn ${dedent(slice(body), indent)};\n}`;

	return `export ${value.async ? 'async ' : ''}function${value.generator ? '*' : ''} ${name}${slice(value.typeParameters)}(${params})${slice(value.returnType)} ${block}`;
}

/**
 * @description Rewrites a plugin entry's `export default { start, stop, getSettingsPanel }` object into named exports,
 * keeping every comment. `getSettingsPanel: () => <Panel />` becomes `export { Panel as SettingsPanel }`.
 * @param code The entry's source.
 * @param id The entry's path; its extension picks the syntax.
 * @returns The migrated source, and the members it left for a hand fix.
 */
export function migrateEntry(code: string, id: string): EntryMigration {
	const { program, comments } = parseSync(id, code);
	const statement = program.body.find((node) => node.type === 'ExportDefaultDeclaration');

	if (!statement) {
		return { code, changed: false, problems: [] };
	}

	const object = statement.declaration;

	if (object.type !== 'ObjectExpression') {
		return {
			code,
			changed: false,
			problems: [
				`${id}: the default export is not an object literal. Fix: export start/stop as named functions by hand.`,
			],
		};
	}

	const output = new MagicString(code);
	const taken = topLevelNames(program);
	const functions = plainFunctions(program);
	const problems: string[] = [];
	const members: Member[] = [];
	const between = (from: number, to: number) =>
		(comments as Comment[])
			.filter((comment) => comment.start >= from && comment.end <= to)
			.map((comment) =>
				dedent(code.slice(comment.start, comment.end), indentAt(code, comment.start)),
			);
	let previous = object.start + 1;

	for (const property of object.properties) {
		const member: Member = { comments: between(previous, property.start) };

		previous = property.end;
		members.push(member);

		const key = property.type === 'Property' ? keyName(property) : undefined;

		if (property.type !== 'Property' || !key || property.kind !== 'init') {
			problems.push(
				`${id}: cannot migrate \`${code.slice(property.start, property.end)}\`. Fix: export it by hand.`,
			);
			continue;
		}

		const name = RENAMED[key] ?? key;
		const value = property.value;
		const component = name === 'SettingsPanel' ? renderedComponent(value) : undefined;

		if (component) {
			member.specifier = component === name ? name : `${component} as ${name}`;
			continue;
		}

		if (value.type === 'Identifier' && key === name) {
			const declaration = functions.get(value.name);

			if (value.name === name && declaration) {
				output.prependLeft(declaration.start, 'export ');
			} else {
				member.specifier = value.name === name ? name : `${value.name} as ${name}`;
			}

			continue;
		}

		if (taken.has(name)) {
			problems.push(
				`${id}: \`${name}\` is already declared, so \`${key}\` cannot become it. Fix: rename one and export it by hand.`,
			);
			continue;
		}

		if (value.type === 'Identifier') {
			// `getSettingsPanel: renderPanel` named a getter; the component renders what it returns.
			member.declaration = `export function ${name}() {\n\treturn ${value.name}();\n}`;
		} else if (
			value.type === 'FunctionExpression' ||
			value.type === 'ArrowFunctionExpression'
		) {
			member.declaration = functionSource(code, name, value, indentAt(code, property.start));
		} else {
			member.declaration = `export const ${name} = ${code.slice(value.start, value.end)};`;
		}
	}

	// A half-migrated entry would drop a member, so the entry stays as it was until each problem is fixed.
	if (problems.length) {
		return { code, changed: false, problems };
	}

	const trailing = between(previous, object.end);
	const declarations = members.flatMap(({ comments: notes, declaration }) =>
		declaration ? [[...notes, declaration].join('\n')] : [],
	);
	const exported = members.filter((member) => member.specifier);
	const loose = members.flatMap(({ comments: notes, declaration, specifier }) =>
		declaration || specifier ? [] : notes,
	);
	const lines = exported.flatMap(({ comments: notes, specifier }) => [...notes, `${specifier},`]);
	const list = exported.some((member) => member.comments.length)
		? `export {\n${lines.map((line) => `\t${line}`).join('\n')}\n};`
		: exported.length
			? `export { ${exported.map((member) => member.specifier).join(', ')} };`
			: '';
	// Comments on members that kept their declaration sit above the export list, which names them.
	const replacement = [...declarations, [...loose, list].filter(Boolean).join('\n'), ...trailing]
		.filter(Boolean)
		.join('\n\n');

	if (replacement) {
		output.overwrite(statement.start, statement.end, replacement);
	} else {
		output.remove(statement.start, statement.end);
	}

	return { code: output.toString(), changed: true, problems };
}

export default { migrateEntry };
