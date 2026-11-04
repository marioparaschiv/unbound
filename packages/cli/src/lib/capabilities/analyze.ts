import {
	NATIVE_PLUGIN_PLATFORM_CAPABILITIES,
	NATIVE_PLUGIN_PLATFORMS,
} from '@unbound-app/types/native';
import type { NativePluginCapability, NativePluginPlatform } from '@unbound-app/types/native';
import { relative, sep } from 'node:path';
import ts from 'typescript-api';

import type { BridgeCall, FileFacts, PlatformHandler, Site } from '~/lib/capabilities/file-facts';
import { readFileFacts, realPath } from '~/lib/capabilities/file-facts';
import { createBridgeTypes } from '~/lib/capabilities/bridge-types';
import type { TypeScriptCache } from '~/lib/check/typescript-cache';
import { createCachedProgram } from '~/lib/check/typescript-cache';

export type PlatformCapabilities = Partial<Record<NativePluginPlatform, NativePluginCapability[]>>;

/** A dynamic or misplaced bridge access, at the node it starts at. */
export type CapabilityError = {
	site: Site;
	message: string;
};

export type CapabilityAnalysis = {
	platforms: PlatformCapabilities;
	errors: CapabilityError[];
};

type Graph = {
	files: string[];
	errors: CapabilityError[];
};

const PLATFORM_CAPABILITIES: Record<NativePluginPlatform, readonly string[]> =
	NATIVE_PLUGIN_PLATFORM_CAPABILITIES;

const DEFAULT_OPTIONS: ts.CompilerOptions = {
	allowJs: true,
	jsx: ts.JsxEmit.Preserve,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	noEmit: true,
	target: ts.ScriptTarget.ESNext,
};

/**
 * @description Works out the platforms an addon runs on and the Capabilities each needs from its
 * code.
 * @param dir The addon's directory; the nearest `tsconfig.json` from here sets the compiler options.
 * @param entry The absolute path of the addon's entry file.
 * @param cache Keeps parsed files across runs, so `ubd check --watch` re-parses only edited ones.
 * @returns The platforms with their Capabilities, and one error per dynamic or misplaced access.
 */
export function analyzeCapabilities(
	dir: string,
	entry: string,
	cache?: TypeScriptCache,
): CapabilityAnalysis {
	const root = realPath(entry);
	const program = createProgram(dir, root, cache);
	const context = { program, bridge: createBridgeTypes(program), siteRoot: realPath(dir) };
	const facts = new Map<string, FileFacts>();

	function factsOf(path: string): FileFacts {
		const cached = facts.get(path);

		if (cached) {
			return cached;
		}

		const file = program.getSourceFile(path) ?? sourceFileByRealPath(program, path);

		if (!file) {
			throw new Error(`${path} is imported but not in the program.`);
		}

		const read = readFileFacts(file, context);

		facts.set(path, read);

		return read;
	}

	function walk(starts: string[], enter: (to: string, from: string) => string | boolean): Graph {
		const seen = new Set<string>();
		const errors: CapabilityError[] = [];
		const queue = [...starts];

		for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
			if (seen.has(path)) {
				continue;
			}

			seen.add(path);

			for (const edge of factsOf(path).imports) {
				const decision = enter(edge.path, path);

				if (typeof decision === 'string') {
					errors.push({ site: edge.site, message: decision });
				} else if (decision) {
					queue.push(edge.path);
				}
			}
		}

		return { files: [...seen], errors };
	}

	const whole = walk([root], () => true);
	const handlers = whole.files.flatMap((path) => factsOf(path).handlers);
	const callsIn = (files: string[]) => files.flatMap((path) => factsOf(path).calls);
	const errors = whole.files.flatMap((path) =>
		factsOf(path).dynamic.map((access) => ({
			site: access.site,
			message: `${access.reason}; ubd build cannot tell which native method it reaches, so call the method by name.`,
		})),
	);

	if (!handlers.length) {
		const calls = callsIn(whole.files);

		for (const platform of NATIVE_PLUGIN_PLATFORMS) {
			errors.push(...describeMisplaced(platform, misplacedCalls(platform, calls)));
		}

		return {
			platforms: Object.fromEntries(
				NATIVE_PLUGIN_PLATFORMS.map((platform) => [
					platform,
					capabilitiesOf(platform, calls),
				]),
			),
			errors,
		};
	}

	const handlerFiles = new Map(handlers.map((handler) => [handler.file, handler]));
	const shared = walk([root], (to, from) => {
		const handler = handlerFiles.get(to);

		if (!handler) {
			return true;
		}

		return handler.declaredIn === from ? false : describeStrayImport(handler, context.siteRoot);
	});
	const sharedFiles = new Set(shared.files);
	const platforms: PlatformCapabilities = {};

	errors.push(...shared.errors);

	for (const platform of NATIVE_PLUGIN_PLATFORMS) {
		const own = handlers.filter((handler) => handler.platform === platform);

		if (!own.length) {
			continue;
		}

		const graph = walk(
			own.map((handler) => handler.file),
			(to) => {
				const handler = handlerFiles.get(to);

				if (sharedFiles.has(to)) {
					return false;
				}

				return (
					!handler ||
					handler.platform === platform ||
					describeStrayImport(handler, context.siteRoot)
				);
			},
		);
		const calls = callsIn([...sharedFiles, ...graph.files]);

		errors.push(
			...graph.errors,
			...describeMisplaced(platform, misplacedCalls(platform, calls)),
		);
		platforms[platform] = capabilitiesOf(platform, calls);
	}

	return { platforms, errors: unique(errors) };
}

function unique(errors: CapabilityError[]): CapabilityError[] {
	const byKey = new Map(
		errors.map((error) => [
			`${error.site.file}:${error.site.line}:${error.site.column} ${error.message}`,
			error,
		]),
	);

	return [...byKey.values()];
}

function createProgram(dir: string, entry: string, cache?: TypeScriptCache): ts.Program {
	const configPath = ts.findConfigFile(dir, (path) => ts.sys.fileExists(path));
	const parsed = configPath
		? ts.getParsedCommandLineOfConfigFile(
				configPath,
				{},
				{ ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => void 0 },
			)
		: undefined;
	const globalDeclarations = parsed?.fileNames.filter((name) => name.endsWith('.d.ts')) ?? [];

	return createCachedProgram(
		`capabilities:${dir}`,
		[entry, ...globalDeclarations],
		{ ...(parsed?.options ?? DEFAULT_OPTIONS), noEmit: true },
		cache,
	);
}

function capabilitiesOf(
	platform: NativePluginPlatform,
	calls: BridgeCall[],
): NativePluginCapability[] {
	const provided = calls
		.map((call) => call.capability)
		.filter((capability) => PLATFORM_CAPABILITIES[platform].includes(capability));

	return [...new Set(provided)].sort();
}

function misplacedCalls(platform: NativePluginPlatform, calls: BridgeCall[]): BridgeCall[] {
	return calls.filter((call) => !PLATFORM_CAPABILITIES[platform].includes(call.capability));
}

function describeMisplaced(platform: NativePluginPlatform, calls: BridgeCall[]): CapabilityError[] {
	const byCapability = new Map<NativePluginCapability, BridgeCall[]>();

	for (const call of calls) {
		byCapability.set(call.capability, [...(byCapability.get(call.capability) ?? []), call]);
	}

	return [...byCapability].flatMap(([capability, [first, ...rest]]) => {
		if (!first) {
			return [];
		}

		const more = rest.length ? ` and ${rest.length} more` : '';

		return [
			{
				site: first.site,
				message: `${platform} cannot provide ${capability}, which ${first.method} needs${more}; select the platform's code with native.definePlatform.`,
			},
		];
	});
}

function sourceFileByRealPath(program: ts.Program, path: string): ts.SourceFile | undefined {
	return program.getSourceFiles().find((file) => realPath(file.fileName) === path);
}

function describeStrayImport(handler: PlatformHandler, dir: string): string {
	const file = relative(dir, handler.file).split(sep).join('/');

	return `imports the ${handler.platform} handler ${file} outside native.definePlatform, so its Capabilities would reach other platforms.`;
}

export default { analyzeCapabilities };
