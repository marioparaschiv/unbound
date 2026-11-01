import { Node, Project, SyntaxKind, ts, type Symbol as MorphSymbol, type Type } from 'ts-morph';
import { join } from 'node:path';

import { ALIAS_ROOT, API_SRC, CLIENT, ROOT, ENTRY } from './paths';

/** A state of `window.unbound`: initialized (`live`), or cleared down after `shutdown()`. */
export type Shape = 'live' | 'shutdown';

/** The sorted dotted key paths reachable on one shape, such as `plugins.start` or `metro.common.React`. */
export type Surface = string[];

export type Gaps = {
	/** Paths the client exposes that the SDK does not type. */
	missing: string[];
	/** Paths the SDK types that the client does not expose. */
	extra: string[];
};

export type SurfaceReport = Record<Shape, Gaps>;

export type RuntimeSurfaces = {
	surfaces: Record<Shape, Surface>;
	/** Paths whose client-declared object type was expanded into its public members. */
	expanded: Set<string>;
};

export type SurfaceSources = {
	/** The client file that assigns each shape to `window.unbound`. */
	entry: string;
	/** The tsconfig the client compiles with. */
	clientConfig?: string;
	/** Object types declared under this directory are compared member by member. */
	clientRoot: string;
	/** The generated `global.d.ts` that types `window.unbound`. */
	global: string;
	/** The tsconfig the generated SDK compiles with. */
	apiConfig?: string;
};

/** The client function whose `window.unbound = { ... }` assignment produces each shape. */
const SHAPE_BY_ASSIGNER: Record<string, Shape> = { initialize: 'live', shutdown: 'shutdown' };

/** The `global.d.ts` type that declares each shape. */
const TYPE_BY_SHAPE: Record<Shape, string> = {
	live: 'UnboundGlobal',
	shutdown: 'UnboundLifecycle',
};

const SHAPES: Shape[] = ['live', 'shutdown'];

export const DEFAULT_SOURCES: SurfaceSources = {
	entry: ENTRY,
	clientConfig: join(CLIENT, 'tsconfig.sdk.json'),
	clientRoot: ALIAS_ROOT,
	global: join(API_SRC, 'global.d.ts'),
	apiConfig: join(ROOT, 'packages', 'api', 'tsconfig.json'),
};

type Walk = {
	anchor: Node;
	paths: string[];
	/** Whether the non-module value at `path` is compared member by member. */
	expand: (path: string, type: Type) => boolean;
	ancestors: Set<ts.Type>;
};

function createProject(tsconfig: string | undefined): Project {
	return tsconfig
		? new Project({ tsConfigFilePath: tsconfig, skipAddingFilesFromTsConfig: true })
		: new Project({ compilerOptions: { strict: true } });
}

function isModule(type: Type): boolean {
	return Boolean(type.getSymbol()?.hasFlags(ts.SymbolFlags.ValueModule));
}

function isPublic(property: MorphSymbol): boolean {
	const name = property.getName();

	if (name === 'default' || name.startsWith('#') || name.startsWith('__#')) {
		return false;
	}

	const flags = ts.getDeclarationModifierFlagsFromSymbol(property.compilerSymbol);

	return (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) === 0;
}

function walk(type: Type, prefix: string, state: Walk) {
	const properties = type
		.getProperties()
		.filter(isPublic)
		.sort((a, b) => a.getName().localeCompare(b.getName()));

	for (const property of properties) {
		const path = prefix ? `${prefix}.${property.getName()}` : property.getName();
		const value = property.getTypeAtLocation(state.anchor);

		state.paths.push(path);

		if (state.ancestors.has(value.compilerType)) {
			continue;
		}

		if (!isModule(value) && !state.expand(path, value)) {
			continue;
		}

		state.ancestors.add(value.compilerType);
		walk(value, path, state);
		state.ancestors.delete(value.compilerType);
	}
}

function readSurface(type: Type, anchor: Node, expand: Walk['expand']): Surface {
	const state: Walk = { anchor, paths: [], expand, ancestors: new Set() };

	walk(type, '', state);

	return [...new Set(state.paths)].sort();
}

function isClientObject(type: Type, clientRoot: string): boolean {
	if (
		!type.isObject() ||
		type.getCallSignatures().length ||
		type.getConstructSignatures().length
	) {
		return false;
	}

	const declaration = type.getSymbol()?.getDeclarations()[0];

	return Boolean(declaration?.getSourceFile().getFilePath().startsWith(clientRoot));
}

/**
 * @description Reads what the client puts on `window.unbound` from the object literals `initialize`
 * and `shutdown` assign, through the TypeScript checker. A spread module namespace contributes its value
 * exports, as an ES namespace object's own keys are exactly those. This static read is the runtime truth:
 * the client cannot be imported under Bun because it needs Discord's metro runtime.
 * @param sources The client entry, its tsconfig and the root whose object types are compared by member.
 * @returns Each shape's surface and the paths expanded into members.
 */
export function readRuntimeSurfaces(
	sources: Pick<SurfaceSources, 'entry' | 'clientConfig' | 'clientRoot'>,
): RuntimeSurfaces {
	const source = createProject(sources.clientConfig).addSourceFileAtPath(sources.entry);
	const surfaces: Partial<Record<Shape, Surface>> = {};
	const expanded = new Set<string>();

	for (const assignment of source.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
		if (
			assignment.getOperatorToken().getKind() !== SyntaxKind.EqualsToken ||
			assignment.getLeft().getText() !== 'window.unbound'
		) {
			continue;
		}

		const literal = assignment.getRight();
		const assigner = assignment
			.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration)
			?.getName();
		const shape = assigner ? SHAPE_BY_ASSIGNER[assigner] : void 0;

		if (!shape || !Node.isObjectLiteralExpression(literal)) {
			throw new Error(
				`Unexpected window.unbound assignment in ${assigner ?? 'top level'}: ${literal.getText()}`,
			);
		}

		surfaces[shape] = readSurface(literal.getType(), literal, (path, type) => {
			if (!isClientObject(type, sources.clientRoot)) {
				return false;
			}

			expanded.add(path);

			return true;
		});
	}

	const { live, shutdown } = surfaces;

	if (!live || !shutdown) {
		throw new Error(
			`Missing a window.unbound assignment in initialize or shutdown in ${sources.entry}.`,
		);
	}

	return { surfaces: { live, shutdown }, expanded };
}

/**
 * @description Reads what the generated SDK types on `window.unbound`: the properties of
 * `UnboundGlobal` (live) and `UnboundLifecycle` (after shutdown). A missing type reads as empty.
 * @param sources The generated `global.d.ts` and the SDK's tsconfig.
 * @param expanded The paths the runtime side expanded; only those are compared member by member.
 * @returns Each shape's typed surface.
 */
export function readTypedSurfaces(
	sources: Pick<SurfaceSources, 'global' | 'apiConfig'>,
	expanded: Set<string>,
): Record<Shape, Surface> {
	const source = createProject(sources.apiConfig).addSourceFileAtPath(sources.global);
	const surfaces: Record<Shape, Surface> = { live: [], shutdown: [] };

	for (const shape of SHAPES) {
		const name = TYPE_BY_SHAPE[shape];
		const declaration = source.getInterface(name) ?? source.getTypeAlias(name);

		surfaces[shape] = declaration
			? readSurface(declaration.getType(), declaration, (path) => expanded.has(path))
			: [];
	}

	return surfaces;
}

/**
 * @description Diffs a runtime surface against a typed one.
 * @param runtime The paths the client exposes.
 * @param typed The paths the SDK types.
 * @returns The paths only one side has, sorted.
 */
export function diffSurfaces(runtime: Surface, typed: Surface): Gaps {
	const typedSet = new Set(typed);
	const runtimeSet = new Set(runtime);

	return {
		missing: runtime.filter((path) => !typedSet.has(path)),
		extra: typed.filter((path) => !runtimeSet.has(path)),
	};
}

/**
 * @description Compares what the client puts on `window.unbound` with what the generated SDK types,
 * for the live and the post-shutdown shape.
 * @param sources Where to read both sides; defaults to the repo's client and `packages/api`.
 * @returns The gaps per shape.
 */
export function checkSurface(sources: SurfaceSources = DEFAULT_SOURCES): SurfaceReport {
	const runtime = readRuntimeSurfaces(sources);
	const typed = readTypedSurfaces(sources, runtime.expanded);

	return {
		live: diffSurfaces(runtime.surfaces.live, typed.live),
		shutdown: diffSurfaces(runtime.surfaces.shutdown, typed.shutdown),
	};
}

/**
 * @description Formats a report as one `[<shape>] missing|extra <path>` line per gap.
 * @param report The gaps per shape.
 * @returns The lines, empty when both sides agree.
 */
export function formatReport(report: SurfaceReport): string[] {
	return SHAPES.flatMap((shape) => [
		...report[shape].missing.map((path) => `[${shape}] missing ${path}`),
		...report[shape].extra.map((path) => `[${shape}] extra ${path}`),
	]);
}

if (import.meta.main) {
	const lines = formatReport(checkSurface());

	for (const line of lines) console.log(line);

	if (lines.length) {
		process.exit(1);
	}

	console.log('window.unbound surface matches the SDK types.');
}
