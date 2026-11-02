import type { CallExpression, Node as MorphNode, SourceFile } from 'ts-morph';
import { Node, Project } from 'ts-morph';

// Rewrites zod schemas as TypeBox in place: `bun scripts/zod-to-typebox.ts <file...>`.
// Leaves codecs, `templateLiteral`, `.options` and `.shape` for a human, named on stderr.

const ZOD_MODULES = new Set(['zod', 'zod/mini', 'zod/v4', 'zod/v4-mini']);

const CHAINED = new Set([
	'check',
	'min',
	'max',
	'length',
	'regex',
	'default',
	'optional',
	'nullable',
	'int',
	'positive',
	'nonnegative',
	'lte',
	'lt',
	'gte',
	'gt',
	'extend',
	'pick',
	'omit',
	'partial',
	'parse',
	'safeParse',
]);

type Kind = 'string' | 'array' | 'number' | 'object' | 'other';

/** A schema expression as TypeBox text, with its options still to be folded in. */
type Built = { text: string; kind: Kind };

type Applied = { options?: string[]; replace?: [string, string]; wraps?: string[] };

/** A migrated file's text and the constructs it left for a human. */
type Migrated = { text: string; warnings: string[] };

/** The `z.<name>` of a call, or `undefined` when it is not a zod factory. */
function zodFactory(call: CallExpression): string | undefined {
	const callee = call.getExpression();

	if (!Node.isPropertyAccessExpression(callee)) {
		return undefined;
	}

	const holder = callee.getExpression();

	if (holder.getText() === 'z') {
		return callee.getName();
	}

	if (Node.isPropertyAccessExpression(holder) && holder.getExpression().getText() === 'z') {
		return `${holder.getName()}.${callee.getName()}`;
	}

	return undefined;
}

/** The innermost expression of a call chain: `z.string()` for `z.string().check(...)`. */
function rootOf(node: MorphNode): MorphNode {
	let current = node;

	while (Node.isCallExpression(current)) {
		const callee = current.getExpression();

		if (!Node.isPropertyAccessExpression(callee)) {
			break;
		}

		current = callee.getExpression();
	}

	return current;
}

function methodOf(node: MorphNode): string | undefined {
	const callee = Node.isCallExpression(node) ? node.getExpression() : undefined;

	return callee && Node.isPropertyAccessExpression(callee) ? callee.getName() : undefined;
}

/** A call that is a zod schema or a chained operation on a named schema. */
function isZodish(node: MorphNode): boolean {
	if (!Node.isCallExpression(node)) {
		return false;
	}

	let current: MorphNode = node;

	while (Node.isCallExpression(current)) {
		if (zodFactory(current)) {
			return true;
		}

		const callee = current.getExpression();

		if (!Node.isPropertyAccessExpression(callee)) {
			break;
		}

		current = callee.getExpression();
	}

	const method = methodOf(node);

	if (!method || !CHAINED.has(method)) {
		return false;
	}

	const root = rootOf(node);

	return Node.isIdentifier(root) && root.getText().endsWith('Schema');
}

function literalText(node: MorphNode): string | undefined {
	return Node.isStringLiteral(node) || Node.isNumericLiteral(node) ? node.getText() : undefined;
}

/** The message in `check(x, 'message')` or `check(x, { message: 'message' })`. */
function messageOf(node: MorphNode | undefined): string | undefined {
	if (!node) {
		return;
	}

	if (Node.isStringLiteral(node)) {
		return node.getText();
	}

	if (Node.isObjectLiteralExpression(node)) {
		const property = node.getProperty('message');

		return property && Node.isPropertyAssignment(property)
			? literalText(property.getInitializer() ?? property)
			: undefined;
	}

	return undefined;
}

function isOptionsObject(text: string): boolean {
	const trimmed = text.trim();

	return trimmed.startsWith('{') && trimmed.endsWith('}');
}

/** Adds an options object to a factory call, merging it into an options object already there. */
function withOptions(text: string, options: string[]): string {
	if (options.length === 0) {
		return text;
	}

	const open = text.lastIndexOf('(');
	const close = text.lastIndexOf(')');
	const existing = text.slice(open + 1, close).trim();
	const added = `{ ${options.join(', ')} }`;

	if (existing === '') {
		return `${text.slice(0, open + 1)}${added}${text.slice(close)}`;
	}

	if (isOptionsObject(existing)) {
		const merged = [existing.slice(1, -1).trim(), options.join(', ')]
			.filter(Boolean)
			.join(', ');

		return `${text.slice(0, open + 1)}{ ${merged} }${text.slice(close)}`;
	}

	// Merge into a trailing options argument, as in `Type.Object(props, { ... })`.
	const last = lastArgument(text, close);

	if (last?.startsWith('{')) {
		const merged = [last.slice(1, -1).trim(), options.join(', ')].filter(Boolean).join(', ');

		return `${text.slice(0, close - last.length)}{ ${merged} }${text.slice(close)}`;
	}

	return `${text.slice(0, open + 1)}${existing}, ${added}${text.slice(close)}`;
}

/** The text of a call's last argument, given the index of its closing parenthesis. */
function lastArgument(text: string, close: number): string | undefined {
	let depth = 0;

	for (let index = close - 1; index >= 0; index--) {
		const char = text[index];

		if (char === ')' || char === ']' || char === '}') {
			depth++;
			continue;
		}

		if (char === '(' || char === '[' || char === '{') {
			depth--;

			if (depth === 0) {
				if (char === '{') {
					continue;
				}

				return undefined;
			}

			continue;
		}

		if ((char === ',' || char === '(') && depth === 0) {
			return text.slice(index + 1, close).trim();
		}
	}

	return undefined;
}

/** The keys of a `{ name: true }` pick map. */
function objectKeys(node: MorphNode | undefined): string[] | undefined {
	if (!node || !Node.isObjectLiteralExpression(node)) {
		return;
	}

	const keys: string[] = [];

	for (const property of node.getProperties()) {
		if (!Node.isPropertyAssignment(property)) {
			return;
		}

		keys.push(JSON.stringify(property.getName()));
	}

	return keys;
}

/** One file's migration: the warnings it collected and the text of each argument. */
class Migrator {
	readonly warnings: string[] = [];

	private readonly sourceFile: SourceFile;

	constructor(sourceFile: SourceFile) {
		this.sourceFile = sourceFile;
	}

	migrate(): void {
		this.visit(this.sourceFile);
		this.rewriteImport();
	}

	private warn(text: string): undefined {
		this.warnings.push(`left ${text}`);

		return undefined;
	}

	private visit(node: MorphNode): void {
		if (Node.isImportDeclaration(node)) {
			const specifier = node.getModuleSpecifierValue();

			if (ZOD_MODULES.has(specifier)) {
				node.setModuleSpecifier('./schema');
			} else if (specifier === './zod' || specifier.endsWith('/zod')) {
				node.setModuleSpecifier(specifier.replace(/zod$/, 'schema'));
			}

			return;
		}

		if (
			Node.isPropertyAccessExpression(node) &&
			node.getName() === 'shape' &&
			node.getExpression().getText().endsWith('Schema')
		) {
			node.getNameNode().replaceWithText('properties');

			return;
		}

		if (Node.isTypeReference(node) && node.getTypeName().getText() === 'z.infer') {
			node.getTypeName().replaceWithText('Static');

			return;
		}

		if (isZodish(node)) {
			const built = this.build(node);

			if (built) {
				node.replaceWithText(built.text);
			} else {
				this.warn(node.getText());
			}

			return;
		}

		for (const child of node.getChildren()) {
			this.visit(child);
		}
	}

	/** The converted text of one argument, converting its children in place first. */
	private argText(node: MorphNode): string {
		const built = this.build(node);

		if (built) {
			return built.text;
		}

		if (!isZodish(node)) {
			this.visit(node);
		}

		return node.getText();
	}

	private build(node: MorphNode): Built | undefined {
		if (!Node.isCallExpression(node)) {
			return undefined;
		}

		const factory = zodFactory(node);
		const args = node.getArguments();
		const texts = (): string[] => args.map((arg) => this.argText(arg));

		if (factory) {
			return this.buildFactory(factory, args, texts, node);
		}

		if (!isZodish(node)) {
			return undefined;
		}

		const method = methodOf(node);
		const callee = node.getExpression();

		if (!method || !Node.isPropertyAccessExpression(callee)) {
			return undefined;
		}

		const target = callee.getExpression();
		const base = this.build(target) ?? this.namedSchema(target);

		if (!base) {
			return undefined;
		}

		if (method === 'parse' || method === 'safeParse') {
			return { text: `${method}(${base.text}, ${texts().join(', ')})`, kind: 'other' };
		}

		if (method === 'extend' && args[0]) {
			return this.extend(base, this.argText(args[0]));
		}

		if ((method === 'pick' || method === 'omit') && args[0]) {
			const keys = objectKeys(args[0]);

			if (!keys) {
				return this.warn(`${method}() with a non-literal key map`);
			}

			const verb = method === 'pick' ? 'Pick' : 'Omit';

			return { text: `Type.${verb}(${base.text}, [${keys.join(', ')}])`, kind: 'object' };
		}

		if (method === 'partial') {
			return { text: `Type.Partial(${base.text})`, kind: 'object' };
		}

		if (method === 'default' && args[0]) {
			return {
				text: withOptions(base.text, [`default: ${this.argText(args[0])}`]),
				kind: base.kind,
			};
		}

		if (method !== 'check') {
			const applied = this.apply(base, method, args);

			return applied ? this.applyAll(base, [applied], node) : undefined;
		}

		const entries: Applied[] = [];

		for (const arg of args) {
			const name = Node.isCallExpression(arg) ? zodFactory(arg) : undefined;
			const applied =
				name && Node.isCallExpression(arg)
					? this.apply(base, name, arg.getArguments())
					: undefined;

			if (!applied) {
				return this.warn(
					args.length === 0 ? node.getText() : String(name ?? arg.getText()),
				);
			}

			entries.push(applied);
		}

		return this.applyAll(base, entries, node);
	}

	private buildFactory(
		name: string,
		args: MorphNode[],
		texts: () => string[],
		node: CallExpression,
	): Built | undefined {
		const all = () => texts().join(', ');
		const simple = (prefix: string, kind: Kind = 'other'): Built => ({
			text: `${prefix}(${all()})`,
			kind,
		});

		switch (name) {
			case 'string':
				return { text: 'Type.String()', kind: 'string' };
			case 'int':
				return { text: 'Type.Integer()', kind: 'number' };
			case 'number':
				return { text: 'Type.Number()', kind: 'number' };
			case 'boolean':
				return simple('Type.Boolean');
			case 'literal':
				return simple('Type.Literal');
			case 'enum':
				return simple('Type.Enum');
			case 'object':
				return simple('Type.Object', 'object');
			case 'strictObject':
				return {
					text: `Type.Object(${all()}, { additionalProperties: false })`,
					kind: 'object',
				};
			case 'looseObject':
				return {
					text: `Type.Object(${all()}, { additionalProperties: true })`,
					kind: 'object',
				};
			case 'array':
				return simple('Type.Array', 'array');
			case 'union':
				return simple('Type.Union');
			case 'discriminatedUnion':
				return args[1]
					? { text: `Type.Union(${this.argText(args[1])})`, kind: 'other' }
					: this.warn(node.getText());
			case 'json':
				return { text: 'Type.Any()', kind: 'other' };
			case 'intersection':
				return simple('Type.Intersect');
			case 'optional':
				return simple('Type.Optional');
			case 'nullable':
				return { text: `Type.Union([${all()}, Type.Null()])`, kind: 'other' };
			case 'record':
				return {
					text: `Type.Record(${all()}, { additionalProperties: false })`,
					kind: 'object',
				};
			case 'partialRecord':
				return {
					text: `Type.Partial(Type.Record(${all()}), { additionalProperties: false })`,
					kind: 'object',
				};
			case 'pick':
			case 'omit': {
				const keys = objectKeys(args[1]);

				if (!keys) {
					return this.warn(`${name}() with a non-literal key map`);
				}

				return {
					text: `Type.${name === 'pick' ? 'Pick' : 'Omit'}(${this.argText(args[0]!)}, [${keys.join(', ')}])`,
					kind: 'object',
				};
			}
			case 'extend': {
				const base = args[0]
					? (this.namedSchema(args[0]) ?? this.build(args[0]))
					: undefined;

				return base && args[1]
					? this.extend(base, this.argText(args[1]))
					: this.warn(node.getText());
			}
			case 'url': {
				if (args.length === 0) {
					return { text: "Type.String({ format: 'url' })", kind: 'string' };
				}

				const protocol =
					args[0] && Node.isObjectLiteralExpression(args[0])
						? args[0].getProperty('protocol')
						: undefined;
				const pattern =
					protocol && Node.isPropertyAssignment(protocol)
						? protocol.getInitializer()?.getText()
						: undefined;

				if (pattern !== '/^https?$/') {
					return this.warn(node.getText());
				}

				return {
					text: "Type.String({ format: 'url', pattern: /^https?:\\/\\//i })",
					kind: 'string',
				};
			}
			case 'uuid':
				return { text: "Type.String({ format: 'uuid' })", kind: 'string' };
			case '_default': {
				const inner = args[0] ? this.argText(args[0]) : undefined;
				const fallback = args[1] ? this.argText(args[1]) : undefined;

				return inner?.includes('(') && fallback
					? { text: withOptions(inner, [`default: ${fallback}`]), kind: 'other' }
					: this.warn(node.getText());
			}
			case 'iso.date':
				return { text: "Type.String({ format: 'date' })", kind: 'string' };
			case 'iso.datetime':
				return { text: "Type.String({ format: 'date-time' })", kind: 'string' };
			default:
				return this.warn(`z.${name}()`);
		}
	}

	private namedSchema(node: MorphNode): Built | undefined {
		if (Node.isIdentifier(node) || Node.isPropertyAccessExpression(node)) {
			return { text: node.getText(), kind: 'other' };
		}

		return undefined;
	}

	private extend(base: Built, props: string): Built {
		return { text: `Type.Object({ ...${base.text}.properties, ...${props} })`, kind: 'object' };
	}

	private apply(base: Built, name: string, args: MorphNode[]): Applied | undefined {
		const [first, second] = args;
		const value = first?.getText();
		const message = messageOf(second);
		const messageOption = (): string[] => (message ? [`errorMessage: ${message}`] : []);
		const option = (key: string): Applied | undefined =>
			value === undefined
				? this.warn(`.${name}() with a non-literal limit`)
				: { options: [`${key}: ${value}`, ...messageOption()] };

		if (name === 'optional') {
			return { wraps: ['Type.Optional($VALUE)'] };
		}

		if (name === 'nullable') {
			return { wraps: ['Type.Union([$VALUE, Type.Null()])'] };
		}

		if (name === 'refine' || name === 'superRefine') {
			if (!first) {
				return this.warn(`.${name}()`);
			}

			const error = `() => ${message ?? "'Invalid value'"}`;

			return {
				wraps: [
					name === 'refine'
						? `Type.Refine($VALUE, ${first.getText()}, ${error})`
						: `superRefine($VALUE, ${first.getText()})`,
				],
			};
		}

		if (name === 'regex' && first) {
			return { options: [`pattern: ${first.getText()}`, ...messageOption()] };
		}

		if (base.kind === 'array') {
			if (name === 'length' && value) {
				return { options: [`minItems: ${value}`, `maxItems: ${value}`] };
			}

			if (name === 'min' || name === 'minLength') {
				return option('minItems');
			}

			if (name === 'max' || name === 'maxLength') {
				return option('maxItems');
			}

			return this.warn(`.${name}()`);
		}

		if (base.kind === 'number') {
			if (name === 'int') {
				return { replace: ['Type.Number(', 'Type.Integer('] };
			}

			if (name === 'positive') {
				return { options: ['exclusiveMinimum: 0'] };
			}

			if (name === 'nonnegative') {
				return { options: ['minimum: 0'] };
			}

			const key =
				name === 'lte' || name === 'max'
					? 'maximum'
					: name === 'lt'
						? 'exclusiveMaximum'
						: name === 'gte' || name === 'min'
							? 'minimum'
							: name === 'gt'
								? 'exclusiveMinimum'
								: undefined;

			return key ? option(key) : this.warn(`.${name}()`);
		}

		if (name === 'minLength' || name === 'min') {
			return option('minLength');
		}

		if (name === 'maxLength' || name === 'max') {
			return option('maxLength');
		}

		if (name === 'length' && value) {
			return { options: [`minLength: ${value}`, `maxLength: ${value}`, ...messageOption()] };
		}

		return this.warn(`.${name}()`);
	}

	private applyAll(base: Built, entries: Applied[], node: MorphNode): Built | undefined {
		let text = base.text;
		const options: string[] = [];

		for (const entry of entries) {
			if (entry.options) {
				options.push(...entry.options);
			}

			if (entry.replace) {
				text = text.replace(entry.replace[0], entry.replace[1]);
			}
		}

		if (options.length > 0 && !text.includes('(')) {
			return this.warn(node.getText());
		}

		text = withOptions(text, options);

		for (const entry of entries) {
			for (const wrap of entry.wraps ?? []) {
				text = wrap.replace('$VALUE', text);
			}
		}

		return { text, kind: base.kind };
	}

	/** Some code mentions `name` as a call or a type. */
	private mentions(name: string): boolean {
		return new RegExp(`\\b${name}\\s*[(<]`).test(this.sourceFile.getFullText());
	}

	/** Rebuilds the schema import so it holds exactly the helpers the migrated file uses. */
	private rewriteImport(): void {
		const declaration = this.sourceFile
			.getImportDeclarations()
			.find((candidate) => candidate.getModuleSpecifierValue() === './schema');

		if (!declaration) {
			return;
		}

		const names = ['Type'];

		if (this.mentions('parse') || this.mentions('safeParse')) {
			names.push('parse', 'safeParse');
		}

		for (const name of ['SchemaIssue', 'superRefine', 'trimmedString']) {
			if (this.mentions(name)) {
				names.push(name);
			}
		}

		names.sort((left, right) => left.localeCompare(right));
		declaration.removeNamedImports();
		declaration.removeNamespaceImport();
		declaration.removeDefaultImport();

		for (const name of names) {
			declaration.addNamedImport(name);
		}

		if (this.mentions('Static')) {
			declaration.addNamedImport({ name: 'Static', isTypeOnly: true });
		}
	}
}

/**
 * @description Rewrites one file's zod schemas to TypeBox.
 * @param source The file's text.
 * @param fileName The path shown in warnings.
 * @returns The migrated text and the constructs left for a human.
 */
export function migrateSource(source: string, fileName: string = 'input.ts'): Migrated {
	const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
	const sourceFile = project.createSourceFile(fileName, source);
	const migrator = new Migrator(sourceFile);

	migrator.migrate();

	return { text: sourceFile.getFullText(), warnings: migrator.warnings };
}

/**
 * @description Rewrites the given files in place, printing what it left for a human.
 * @param paths The files to migrate.
 */
export function migrateFiles(paths: string[]): void {
	const project = new Project({ skipAddingFilesFromTsConfig: true });

	for (const path of paths) {
		const sourceFile = project.addSourceFileAtPath(path);
		const migrator = new Migrator(sourceFile);

		migrator.migrate();

		for (const warning of migrator.warnings) {
			console.warn(`${path}: ${warning}`);
		}

		console.warn(`${path}: ${migrator.warnings.length} left for a human`);
	}

	void project.save();
}

if (import.meta.main) {
	const paths = process.argv.slice(2);

	if (paths.length === 0) {
		console.error('usage: bun packages/contracts/scripts/zod-to-typebox.ts <file...>');
		process.exit(1);
	}

	migrateFiles(paths);
}
