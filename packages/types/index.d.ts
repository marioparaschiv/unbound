// Global type declarations - automatically available without imports
/// <reference path="./modules/utils.d.ts" />
/// <reference path="./modules/global.d.ts" />

// Re-export submodules for convenience
// Note: Some types may conflict between modules
// It's recommended to import from specific subpaths like @unbound-app/types/api
export * as API from './modules/api/index';
export * as BuiltIns from './modules/built-ins/index';
export * as Discord from './modules/discord/index';
export * as Managers from './modules/managers/index';
export * as Stores from './modules/stores/index';
export * as UI from './modules/ui/index';
export * as Utilities from './modules/utilities/index';