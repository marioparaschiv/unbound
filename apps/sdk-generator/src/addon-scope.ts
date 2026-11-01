import { Node, SyntaxKind } from 'ts-morph';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseSource } from './project';
import { ROOT } from './paths';

type ScopeGlobal = {
	sdkType: string;
	/** The global's comment in the SDK's `AddonScope`. */
	doc: string;
	/** Whether `global.d.ts` declares the global; lib declares the timers and `@unbound-app/types` declares `React`. */
	declare: boolean;
};

const ADDONS_TYPINGS = join(ROOT, 'packages', 'types', 'typings', 'addons.ts');

/**
 * Each Addon scope global (ADR-0002) in SDK terms. The client types its globals as client namespaces,
 * which dts-bundle-generator cannot bundle, so the SDK names them through `UnboundGlobal` instead.
 */
const ADDON_SCOPE: Record<string, ScopeGlobal> = {
	React: {
		sdkType: 'typeof React',
		doc: "Discord's React, whose `createElement` keeps a reloaded plugin's components matched to their mounted ones.",
		declare: false,
	},
	unbound: {
		sdkType: 'UnboundGlobal',
		doc: 'The Unbound API, with the `metro`, `storage`, `flux`, `patcher` and `commands` listeners scoped to this plugin.',
		declare: true,
	},
	// Not `AddonHandle<Plugin>`: `_internal.d.ts` declares `Plugin` as `Plugin$1`, and the bare name is lib.dom's.
	addon: {
		sdkType: 'AddonHandle',
		doc: "This plugin's handle: its manifest and state.",
		declare: true,
	},
	patcher: {
		sdkType: "UnboundGlobal['patcher']",
		doc: "The patcher, tagging each patch with this plugin's id; Unbound removes them when it stops.",
		declare: true,
	},
	logger: {
		sdkType: 'AddonLogger',
		doc: "A logger that prefixes each line with this plugin's name.",
		declare: true,
	},
	setTimeout: {
		sdkType: 'typeof setTimeout',
		doc: '`setTimeout`, cleared when this plugin stops.',
		declare: false,
	},
	setInterval: {
		sdkType: 'typeof setInterval',
		doc: '`setInterval`, cleared when this plugin stops.',
		declare: false,
	},
	clearTimeout: {
		sdkType: 'typeof clearTimeout',
		doc: 'Clears a timer this plugin set with `setTimeout`.',
		declare: false,
	},
	clearInterval: {
		sdkType: 'typeof clearInterval',
		doc: 'Clears a timer this plugin set with `setInterval`.',
		declare: false,
	},
	commands: {
		sdkType:
			"Omit<ReturnType<UnboundGlobal['commands']['createCommands']>, keyof UnboundGlobal['commands']> & UnboundGlobal['commands']",
		doc: "The commands API, registering each command under this plugin's id; Unbound removes them when it stops.",
		declare: true,
	},
};

/**
 * @description Reads the names in a typings file's `ADDON_SCOPE_GLOBALS` array.
 * @param path The typings file.
 * @returns The names, in parameter order.
 */
export function readScopeGlobalNames(path: string = ADDONS_TYPINGS): string[] {
	const source = parseSource('addons.ts', readFileSync(path, 'utf8'));
	const initializer = source
		.getVariableDeclarationOrThrow('ADDON_SCOPE_GLOBALS')
		.getInitializerOrThrow();
	const list = Node.isAsExpression(initializer) ? initializer.getExpression() : initializer;

	return list
		.asKindOrThrow(SyntaxKind.ArrayLiteralExpression)
		.getElements()
		.map((element) => element.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue());
}

/**
 * @description Pairs each Addon scope global with its SDK type, so a global added to the client fails generation until it is typed here.
 * @param path The typings file holding `ADDON_SCOPE_GLOBALS`.
 * @returns Each global's name and SDK type, in parameter order.
 */
export function addonScopeGlobals(path: string = ADDONS_TYPINGS): [string, ScopeGlobal][] {
	const names = readScopeGlobalNames(path);
	const untyped = names.filter((name) => !Object.hasOwn(ADDON_SCOPE, name));
	const stale = Object.keys(ADDON_SCOPE).filter((name) => !names.includes(name));

	if (untyped.length > 0 || stale.length > 0) {
		throw new Error(
			`ADDON_SCOPE in apps/sdk-generator/src/addon-scope.ts is out of date with ADDON_SCOPE_GLOBALS. Untyped: [${untyped.join(', ')}]. Stale: [${stale.join(', ')}].`,
		);
	}

	return names.map((name) => [name, ADDON_SCOPE[name]]);
}
