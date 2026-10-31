import type { Project } from 'ts-morph';

import type { ImportRef, ModuleFacts, ModuleRecord } from './types';

import { extractModule } from './extract';

/**
 * @description Parses the modules defining the functions props are passed to and the constants they are compared
 * with or default to, following re-exports and the calls those functions make in turn.
 * @param parser The parser project.
 * @param facts The modules parsed so far; newly parsed ones are appended.
 * @param unparsed The modules not parsed yet, by id; parsed ones are removed.
 */
export function parseCallees(
	parser: Project,
	facts: ModuleFacts[],
	unparsed: Map<number, ModuleRecord>,
) {
	const parsed = new Map(facts.map((module) => [module.moduleId, module]));
	const queue = facts.flatMap(calleesOf);
	const visited = new Set<string>();

	for (let ref = queue.pop(); ref; ref = queue.pop()) {
		const key = `${ref.moduleId}:${ref.name}`;

		if (visited.has(key)) {
			continue;
		}

		visited.add(key);

		let module = parsed.get(ref.moduleId);
		const record = unparsed.get(ref.moduleId);

		if (!module && record) {
			module = extractModule(parser, record);
			unparsed.delete(ref.moduleId);
			parsed.set(module.moduleId, module);
			facts.push(module);
			queue.push(...calleesOf(module));
		}

		if (!module) {
			continue;
		}

		queue.push(...forwardedRefs(module, ref.name));
	}
}

// What `name` on the module points at elsewhere: a re-export, or the module itself under an interop default.
function forwardedRefs(module: ModuleFacts, name: string): ImportRef[] {
	const refs: ImportRef[] = [];

	if (name.startsWith('default.')) {
		refs.push({ kind: 'import', moduleId: module.moduleId, name: name.slice(8) });
	}

	for (const { exportName, target } of module.reExports) {
		if (name === exportName) {
			refs.push(target);
		} else if (name.startsWith(`${exportName}.`)) {
			refs.push({ ...target, name: `${target.name}${name.slice(exportName.length)}` });
		}
	}

	for (const moduleId of module.starExports) {
		refs.push({ kind: 'import', moduleId, name });
	}

	return refs;
}

function calleesOf(module: ModuleFacts): ImportRef[] {
	const refs: ImportRef[] = [];

	for (const record of [...module.components, ...module.functions]) {
		for (const evidence of [...record.props.values(), ...record.params.values()]) {
			for (const observation of evidence) {
				if (observation.kind === 'argument' && observation.callee.kind === 'import') {
					refs.push(observation.callee);
				} else if (
					observation.kind === 'compared-ref' ||
					observation.kind === 'default-ref'
				) {
					refs.push(observation.ref);
				}
			}
		}
	}

	return refs;
}

export default { parseCallees };
