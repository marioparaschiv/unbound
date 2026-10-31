import type { ComponentKind, ComponentRecord, ExportEntry } from './types';
import type { Inference } from './infer';
import type { RuleName } from './rules';

import { isRequired } from './emit';

export type ComponentReport = {
	type: string;
	name: string;
	path: string | undefined;
	moduleId: number;
	exportNames: string[];
	kind: ComponentKind;
	props: number;
	typed: number;
	unknown: number;
	required: number;
	rest: string | undefined;
};

export type Report = {
	build: string;
	modules: number;
	candidateModules: number;
	reactNativeModule: number | undefined;
	pascalCaseFunctions: number;
	components: number;
	exportedComponents: number;
	props: number;
	typedProps: number;
	typedPercent: number;
	rules: Partial<Record<RuleName, number>>;
	perComponent: ComponentReport[];
};

/** Counts gathered while streaming, before inference. */
export type ScanStats = {
	build: string;
	modules: number;
	candidateModules: number;
	reactNativeModule: number | undefined;
	pascalCaseFunctions: number;
};

/**
 * @description Summarizes coverage: how many components were found and typed, and how each prop was typed.
 * @param stats Counts from the scan.
 * @param components The emitted components.
 * @param names The type name base per component.
 * @param inference The inference.
 * @param exports The components reachable through a module export.
 * @returns The report.
 */
export function buildReport(
	stats: ScanStats,
	components: ComponentRecord[],
	names: Map<ComponentRecord, string>,
	inference: Inference,
	exports: ExportEntry[],
): Report {
	const rules: Partial<Record<RuleName, number>> = {};
	let props = 0;
	let typedProps = 0;

	const perComponent = components.map((component): ComponentReport => {
		let typed = 0;
		let required = 0;

		for (const [key, evidence] of component.props) {
			const { rule } = inference.typeOf(component, key);

			rules[rule] = (rules[rule] ?? 0) + 1;
			typed += rule === 'unknown' ? 0 : 1;
			required += isRequired(evidence) ? 1 : 0;
		}

		props += component.props.size;
		typedProps += typed;

		const rest = inference.restOf.get(component);

		return {
			type: `${names.get(component)}Props`,
			name: component.name,
			path: component.path,
			moduleId: component.moduleId,
			exportNames: [...new Set(component.exportNames)].sort(),
			kind: component.kind,
			props: component.props.size,
			typed,
			unknown: component.props.size - typed,
			required,
			rest:
				rest?.kind === 'host'
					? `RN.${rest.name}`
					: rest && `${names.get(rest.component)}Props`,
		};
	});

	return {
		...stats,
		components: components.length,
		exportedComponents: new Set(exports.map((entry) => entry.component)).size,
		props,
		typedProps,
		typedPercent: props === 0 ? 0 : Math.round((typedProps / props) * 1000) / 10,
		rules,
		perComponent,
	};
}

export default { buildReport };
