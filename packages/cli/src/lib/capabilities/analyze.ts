import {
	NATIVE_PLUGIN_PLATFORM_CAPABILITIES,
	NATIVE_PLUGIN_PLATFORMS,
} from '@unbound-app/types/native';
import type { NativePluginCapability, NativePluginPlatform } from '@unbound-app/types/native';
import { relative, sep } from 'node:path';
import ts from 'typescript';

import type { BridgeCall, FileFacts, PlatformHandler } from '~/lib/capabilities/file-facts';
import { readFileFacts, realPath } from '~/lib/capabilities/file-facts';
import { createBridgeTypes } from '~/lib/capabilities/bridge-types';

export type PlatformCapabilities = Partial<Record<NativePluginPlatform, NativePluginCapability[]>>;

export type CapabilityAnalysis = {
	platforms: PlatformCapabilities;
	errors: string[];
};

type Graph = {
	files: string[];
	errors: string[];
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
 * @returns The platforms with their Capabilities, and one error per dynamic or misplaced access.
 */
export function analyzeCapabilities(dir: string, entry: string): CapabilityAnalysis {
	const program = createProgram(dir, entry);
	const context = { program, bridge: createBridgeTypes(program), siteRoot: dir };
	const facts = new Map<string, FileFacts>();
	const root = realPath(entry);

	function factsOf(path: string): FileFacts {
		const cached = facts.get(path);

		if (cached) {
			return cached;
		}

		const file = program.getSourceFile(path);

		if (!file) {
			throw new Error(`${path} is imported but not in the program.`);
		}

		const read = readFileFacts(file, context);

		facts.set(path, read);

		return read;
	}

	function walk(starts: string[], enter: (to: string, from: string) => string | boolean): Graph {
		const seen = new Set<string>();
		const errors: string[] = [];
		const queue = [...starts];

		for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
			if (seen.has(path)) {
				continue;
			}

			seen.add(path);

			for (const edge of factsOf(path).imports) {
				const decision = enter(edge.path, path);

				if (typeof decision === 'string') {
					errors.push(`${edge.site} ${decision}`);
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
		factsOf(path).dynamic.map(
			(access) =>
				`${access.site} ${access.reason}; ubd build cannot tell which native method it reaches, so call the method by name.`,
		),
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

		return handler.declaredIn === from ? false : describeStrayImport(handler, dir);
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
					!handler || handler.platform === platform || describeStrayImport(handler, dir)
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

	return { platforms, errors: [...new Set(errors)] };
}

function createProgram(dir: string, entry: string): ts.Program {
	const configPath = ts.findConfigFile(dir, (path) => ts.sys.fileExists(path));
	const parsed = configPath
		? ts.getParsedCommandLineOfConfigFile(
				configPath,
				{},
				{ ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => void 0 },
			)
		: undefined;
	const globalDeclarations = parsed?.fileNames.filter((name) => name.endsWith('.d.ts')) ?? [];

	return ts.createProgram({
		rootNames: [entry, ...globalDeclarations],
		options: { ...(parsed?.options ?? DEFAULT_OPTIONS), noEmit: true },
	});
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

function describeMisplaced(platform: NativePluginPlatform, calls: BridgeCall[]): string[] {
	const byCapability = new Map<NativePluginCapability, BridgeCall[]>();

	for (const call of calls) {
		byCapability.set(call.capability, [...(byCapability.get(call.capability) ?? []), call]);
	}

	return [...byCapability].map(([capability, [first, ...rest]]) => {
		const more = rest.length ? ` and ${rest.length} more` : '';

		return `${platform} cannot provide ${capability}, which ${first?.site} needs for ${first?.method}${more}; select the platform's code with native.definePlatform.`;
	});
}

function describeStrayImport(handler: PlatformHandler, dir: string): string {
	const file = relative(dir, handler.file).split(sep).join('/');

	return `imports the ${handler.platform} handler ${file} outside native.definePlatform, so its Capabilities would reach other platforms.`;
}

export default { analyzeCapabilities };
