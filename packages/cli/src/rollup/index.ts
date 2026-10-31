export {
	bytecodeFileName,
	bytecodeSource,
	hermesBytecode,
	hermescCount,
} from './hermes-bytecode.ts';
export { pluginConfig, unbound, type PluginConfigOptions } from './preset.ts';
export { externalFor, unboundGlobals, type Globals } from './globals.ts';
export { lazyModules, lazyModuleSource } from './lazy-modules.ts';
export { hermesExpressionEntrypoint } from './entrypoint.ts';
export { findFile, sourceAlias } from './source-alias.ts';
