import { parseSync, Visitor, type ESTree } from './rolldown-utils.ts';

/** One message-key problem in a `commands.register(...)` literal, at the node it points to. */
export type CommandTextProblem = {
	line: number;
	column: number;
	/** The command it belongs to, such as `/coin flip`. */
	command: string;
	problem: string;
	fix: string;
};

/** What the build knows of a plugin's translations: its en-US messages, or none without an `i18n/` folder. */
export type SourceLocale = Readonly<Record<string, string>> | undefined;

/** The `commands.register(...)` literals of one module, and their problems. */
export type CommandTextReport = {
	/** Whether the module registers commands the build can see. */
	registers: boolean;
	problems: CommandTextProblem[];
};

type Node = ESTree.Node;

type Position = { line: number; column: number };

type Walk = {
	source: SourceLocale;
	at: (node: Node) => Position;
	problems: CommandTextProblem[];
};

const BUILDERS = new Set([
	'string',
	'integer',
	'number',
	'boolean',
	'user',
	'channel',
	'role',
	'choice',
]);
const COMMAND_MODULES = new Set(['@unbound-app/api', '@unbound-app/api/commands']);
const MAX_TEXT = 100;
const SOURCE_FILE = 'i18n/en-US.json';

// TypeScript and parentheses wrap a literal without changing it.
function unwrap(node: Node): Node {
	if (
		node.type === 'TSAsExpression' ||
		node.type === 'TSSatisfiesExpression' ||
		node.type === 'TSNonNullExpression' ||
		node.type === 'ParenthesizedExpression'
	) {
		return unwrap(node.expression);
	}

	return node;
}

function propertyName(node: Node): string | undefined {
	if (node.type === 'Identifier') {
		return node.name;
	}

	if (
		node.type === 'Literal' &&
		(typeof node.value === 'string' || typeof node.value === 'number')
	) {
		return String(node.value);
	}

	return undefined;
}

function properties(node: ESTree.ObjectExpression): Map<string, ESTree.ObjectProperty> {
	const found = new Map<string, ESTree.ObjectProperty>();

	for (const property of node.properties) {
		if (property.type !== 'Property' || property.computed) {
			continue;
		}

		const name = propertyName(property.key);

		if (name !== undefined) {
			found.set(name, property);
		}
	}

	return found;
}

function staticString(node: Node): string | undefined {
	if (node.type === 'Literal' && typeof node.value === 'string') {
		return node.value;
	}

	if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
		return node.quasis[0]?.value.cooked ?? undefined;
	}

	return undefined;
}

// A key is one token in SCREAMING_CASE or dotted; anything with spaces, or plain words, is text to translate.
function looksLikeKey(text: string): boolean {
	return /^[A-Z][A-Z0-9_.]*$/.test(text) || (/^[\w.-]+$/.test(text) && /[_.]/.test(text));
}

function suggestKey(parts: readonly string[]): string {
	return parts
		.join('_')
		.toUpperCase()
		.replaceAll(/[^A-Z0-9]+/g, '_');
}

function keyWithText(source: SourceLocale, text: string): string | undefined {
	return Object.entries(source ?? {}).find(([, message]) => message === text)?.[0];
}

function report(walk: Walk, node: Node, command: string, problem: string, fix: string) {
	walk.problems.push({ ...walk.at(node), command, problem, fix });
}

/**
 * Checks one place that takes a message key. Text the build cannot read, such as a variable or call,
 * is left to the runtime check, which throws `CommandDefinitionError` naming the command and key.
 */
function checkKey(walk: Walk, value: Node, command: string, what: string, suggested: string[]) {
	const node = unwrap(value);
	const text = staticString(node);

	if (node.type === 'Literal' && text === undefined) {
		report(
			walk,
			node,
			command,
			`${what} ${String(node.value)} is not a message key`,
			'pass a key of i18n/en-US.json.',
		);

		return;
	}

	if (text === undefined || walk.source === undefined) return;

	const message = Object.hasOwn(walk.source, text) ? walk.source[text] : undefined;

	if (message !== undefined) {
		if (!message.trim() || message.length > MAX_TEXT) {
			report(
				walk,
				node,
				command,
				`${what} ${text} is ${message.length} characters in ${SOURCE_FILE}`,
				`shorten its en-US text to 1-${MAX_TEXT} characters.`,
			);
		}

		return;
	}

	if (looksLikeKey(text)) {
		report(
			walk,
			node,
			command,
			`${what} key "${text}" is missing from ${SOURCE_FILE}`,
			`add "${text}": "<en-US text>" to ${SOURCE_FILE}.`,
		);

		return;
	}

	const existing = keyWithText(walk.source, text);

	report(
		walk,
		node,
		command,
		`${what} ${JSON.stringify(text)} is literal text where a message key is required`,
		existing
			? `use its key "${existing}".`
			: `add "${suggestKey(suggested)}": ${JSON.stringify(text)} to ${SOURCE_FILE} and use the key.`,
	);
}

function builderOf(node: Node): { name: string; call: ESTree.CallExpression } | undefined {
	const call = unwrap(node);

	if (
		call.type !== 'CallExpression' ||
		call.callee.type !== 'MemberExpression' ||
		call.callee.computed
	) {
		return undefined;
	}

	const name = propertyName(call.callee.property);

	return name && BUILDERS.has(name) ? { name, call } : undefined;
}

function checkSettings(
	walk: Walk,
	node: Node | undefined,
	command: string,
	option: string,
	path: string[],
) {
	const settings = node && unwrap(node);

	if (settings?.type !== 'ObjectExpression') return;

	const description = properties(settings).get('description');

	if (description) {
		checkKey(walk, description.value, command, `option "${option}" description`, [
			...path,
			option,
			'desc',
		]);
	}
}

function checkOption(walk: Walk, name: string, value: Node, command: string, path: string[]) {
	const builder = builderOf(value);

	if (!builder) return;

	const [first, second] = builder.call.arguments;

	if (builder.name !== 'choice') {
		checkSettings(walk, first, command, name, path);

		return;
	}

	const choices = first && unwrap(first);

	if (choices?.type === 'ArrayExpression') {
		report(
			walk,
			choices,
			command,
			`option "${name}" uses the removed array form of option.choice`,
			`map each value to a key: option.choice({ value: 'KEY' }).`,
		);
	} else if (choices?.type === 'ObjectExpression') {
		for (const [choice, property] of properties(choices)) {
			checkKey(walk, property.value, command, `option "${name}" choice "${choice}" label`, [
				...path,
				name,
				choice,
			]);
		}
	}

	checkSettings(walk, second, command, name, path);
}

function valueOf(property: ESTree.ObjectProperty | undefined): Node | undefined {
	return property && unwrap(property.value);
}

function checkCommand(walk: Walk, node: Node, path: string[]) {
	const command = unwrap(node);

	if (command.type !== 'ObjectExpression') return;

	const label = `/${path.join(' ')}`;
	const fields = properties(command);
	const description = fields.get('description');
	const options = valueOf(fields.get('options'));
	const subcommands = valueOf(fields.get('subcommands'));

	if (description) {
		checkKey(walk, description.value, label, 'description', [...path, 'desc']);
	}

	if (options?.type === 'ObjectExpression') {
		for (const [name, property] of properties(options)) {
			checkOption(walk, name, property.value, label, path);
		}
	}

	if (subcommands?.type === 'ObjectExpression') {
		checkTree(walk, subcommands, path);
	}
}

function checkTree(walk: Walk, tree: ESTree.ObjectExpression, path: string[]) {
	for (const [name, property] of properties(tree)) {
		checkCommand(walk, property.value, [...path, name]);
	}
}

function positions(code: string): (node: Node) => Position {
	const starts = [0];

	for (let i = 0; i < code.length; i++) {
		if (code[i] === '\n') {
			starts.push(i + 1);
		}
	}

	return (node) => {
		let line = starts.length - 1;

		while ((starts[line] ?? 0) > node.start) line--;

		return { line: line + 1, column: node.start - (starts[line] ?? 0) + 1 };
	};
}

// The names that reach a commands handle: the `commands` global or import, `createCommands` results, `register`.
function isRegister(callee: Node, handles: Set<string>, registers: Set<string>): boolean {
	if (callee.type === 'Identifier') {
		return registers.has(callee.name);
	}

	if (
		callee.type !== 'MemberExpression' ||
		callee.computed ||
		propertyName(callee.property) !== 'register'
	) {
		return false;
	}

	const target = unwrap(callee.object);

	if (target.type === 'Identifier') {
		return target.name === 'commands' || handles.has(target.name);
	}

	return (
		target.type === 'MemberExpression' &&
		!target.computed &&
		propertyName(target.property) === 'commands'
	);
}

function isCreateCommands(node: Node | null | undefined): boolean {
	const call = node && unwrap(node);

	if (call?.type !== 'CallExpression') {
		return false;
	}

	const { callee } = call;

	if (callee.type === 'Identifier') {
		return callee.name === 'createCommands';
	}

	return (
		callee.type === 'MemberExpression' &&
		!callee.computed &&
		propertyName(callee.property) === 'createCommands'
	);
}

/**
 * @description Finds every `commands.register({...})` object literal in a module on the oxc AST and checks each
 * description, option description and choice label against the plugin's en-US messages.
 * @param code The module's source, before any transform, so positions match the file.
 * @param file The module's path; its extension picks the parser's language.
 * @param source The plugin's en-US messages, or `undefined` when it has no `i18n/` folder.
 * @returns Whether the module registers commands, and each problem with its line and column.
 */
export function checkCommandText(
	code: string,
	file: string,
	source: SourceLocale,
): CommandTextReport {
	const { program } = parseSync(file, code);
	const walk: Walk = { source, at: positions(code), problems: [] };
	const handles = new Set<string>();
	const registers = new Set<string>();
	let registered = false;

	new Visitor({
		ImportDeclaration(node) {
			if (!COMMAND_MODULES.has(String(node.source.value))) return;

			for (const specifier of node.specifiers) {
				if (
					specifier.type === 'ImportSpecifier' &&
					propertyName(specifier.imported) === 'register'
				) {
					registers.add(specifier.local.name);
				}
			}
		},
		VariableDeclarator(node) {
			if (node.id.type === 'Identifier' && isCreateCommands(node.init)) {
				handles.add(node.id.name);
			}
		},
	}).visit(program);

	new Visitor({
		CallExpression(node) {
			if (!isRegister(node.callee, handles, registers)) return;

			registered = true;

			const tree = node.arguments[0] && unwrap(node.arguments[0]);

			if (tree?.type !== 'ObjectExpression') return;

			if (source === undefined) {
				const roots = [...properties(tree).keys()].map((name) => `/${name}`).join(' ');

				report(
					walk,
					node,
					roots || '/',
					'registers commands, but the plugin has no i18n/ folder',
					`add ${SOURCE_FILE} with a key for each command description.`,
				);

				return;
			}

			checkTree(walk, tree, []);
		},
	}).visit(program);

	return { registers: registered, problems: walk.problems };
}

export default { checkCommandText };
