import type { ComponentRecord, ModuleFacts, ModuleRecord, ModuleSummary } from './types';
import type { ModuleShape } from './module-shapes';
import type { AssetRecord } from './assets';
import type { HostProps } from './hosts';
import type { Report } from './report';

import { ASSETS_FILE, collectAssets, emitAssets, namesByType } from './assets';
import { createResolver, findReactNative, listExports } from './resolve';
import { createConstantLookup, resolveConstantRefs } from './constants';
import { emitModuleIndex, MODULE_INDEX_FILE } from './emit-modules';
import { isComponentCandidate, summarize } from './split';
import { createParser, extractModule } from './extract';
import { assignNames, sortComponents } from './naming';
import { bindPassed, isHookName } from './evidence';
import { shapeOf } from './module-shapes';
import { parseCallees } from './callees';
import { buildReport } from './report';
import { infer } from './infer';
import { emit } from './emit';

export type PipelineResult = {
	files: Map<string, string>;
	report: Report;
};

/**
 * @description A PascalCase function counts as a component when it renders JSX (itself, in a nested callback or
 * through its class methods) or is wrapped by `memo` or `forwardRef`.
 * @param component The candidate.
 * @returns True for components.
 */
export function isComponent(component: ComponentRecord): boolean {
	return component.rendersJsx || component.kind === 'memo' || component.kind === 'forwardRef';
}

/**
 * @description Runs every stage over a build's modules: extract, resolve, infer, emit. Also emits the names of
 * the assets the build registers.
 * @param build The build's name, printed in the generated docs.
 * @param modules The build's modules, as the splitter yields them.
 * @param hosts React Native host props.
 * @returns The generated files and the coverage report.
 */
export async function runPipeline(
	build: string,
	modules: Iterable<ModuleRecord> | AsyncIterable<ModuleRecord>,
	hosts: HostProps,
): Promise<PipelineResult> {
	const parser = createParser();
	const summaries: ModuleSummary[] = [];
	const facts: ModuleFacts[] = [];
	const shapes: ModuleShape[] = [];
	const unparsed = new Map<number, ModuleRecord>();
	const assets: AssetRecord[] = [];

	for await (const module of modules) {
		const summary = summarize(module);

		assets.push(...collectAssets(module));
		const reExports = summary.exportNames.some((name) => /^[A-Z]/.test(name));
		const hooks = summary.exportNames.some(isHookName);

		summaries.push(summary);
		shapes.push(shapeOf(module));

		// Modules that only re-export a component (`Button.native.tsx`) are parsed too, so lookups resolve, and so are
		// hook modules, whose summaries type the components spreading a hook's result.
		if (reExports || hooks || isComponentCandidate(module.source)) {
			facts.push(extractModule(parser, module));
		} else if (summary.exportNames.length > 0) {
			// Kept until the parsed modules show which of these define functions their props are passed to.
			unparsed.set(module.id, module);
		}
	}

	parseCallees(parser, facts, unparsed);

	const reactNative = findReactNative(summaries);
	const resolve = createResolver(facts, reactNative, new Set(hosts.keys()));

	bindPassed(facts, resolve);

	const found = facts.flatMap((module) => module.components);

	resolveConstantRefs(
		facts.flatMap((module) => [...module.components, ...module.functions]),
		createConstantLookup(facts),
	);

	const components = sortComponents(found.filter(isComponent));
	const names = assignNames(components);
	const inference = infer(components, resolve, hosts, names);
	const paths = new Map(summaries.map((summary) => [summary.id, summary.path]));
	const exports = listExports(facts, resolve, new Set(components), paths);
	const { files, barrelComponents: typed } = emit({
		build,
		components,
		names,
		inference,
		resolve,
		exports,
	});
	const assetNames = namesByType(assets);

	files.set(ASSETS_FILE, emitAssets(build, assetNames));
	files.set(MODULE_INDEX_FILE, emitModuleIndex({ build, shapes, exports, names, typed }));

	const report = buildReport(
		{
			build,
			modules: summaries.length,
			candidateModules: facts.length,
			reactNativeModule: reactNative,
			pascalCaseFunctions: found.length,
			assetNames: Object.fromEntries(
				[...assetNames].map(([type, list]) => [type, list.length]),
			),
		},
		components,
		names,
		inference,
		exports,
	);

	return { files, report };
}

export default { isComponent, runPipeline };
