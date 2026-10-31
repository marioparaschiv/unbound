import { Project } from 'ts-morph';
import { join } from 'node:path';

/** React Native component name to the prop names its typings declare. */
export type HostProps = Map<string, ReadonlySet<string>>;

/**
 * @description Reads the React Native typings the types package resolves and lists every component's props,
 * so emitted `ComponentProps<typeof View>['key']` references only name keys that exist.
 * @param typesDir The `packages/types` directory, whose `tsconfig.json` and `node_modules` resolve `react-native`.
 * @returns The prop names per host component.
 */
export function loadHostProps(typesDir: string): HostProps {
	const project = new Project({
		tsConfigFilePath: join(typesDir, 'tsconfig.json'),
		skipAddingFilesFromTsConfig: true,
	});
	const probe = project.createSourceFile(
		join(typesDir, '__discord_typegen_hosts__.ts'),
		"import * as RN from 'react-native';",
	);
	const namespace = probe.getImportDeclarations()[0]?.getNamespaceImport()?.getSymbol();
	const module = namespace?.getAliasedSymbol() ?? namespace;
	// `getExportsOfModule` follows the `export *` re-exports that make up the React Native entry.
	const names = module ? project.getTypeChecker().getExportsOfModule(module) : [];
	const candidates = names
		.map((symbol) => symbol.getName())
		.filter((name) => /^[A-Z]/.test(name));

	probe.addStatements([
		"import type { ComponentProps } from 'react';",
		...candidates.map(
			(name) => `export type Host_${name} = ComponentProps<typeof RN.${name}>;`,
		),
	]);

	const hosts: HostProps = new Map();

	for (const name of candidates) {
		const type = probe.getTypeAliasOrThrow(`Host_${name}`).getType();

		if (type.isAny() || type.isNever() || type.isUnknown()) {
			continue;
		}

		const props = type.getProperties().map((symbol) => symbol.getName());

		if (props.length > 0) {
			hosts.set(name, new Set(props));
		}
	}

	return hosts;
}

export default { loadHostProps };
