// What a plugin's tests import, beside the preset in their bunfig.toml: the lifecycle, `render` and the recorders.
export {
	toasts,
	dialogs,
	commands,
	patches,
	flux,
	metro,
	native,
	plugins,
	fs,
	logs,
	setLocale,
	extendApi,
	type ToastRecorder,
	type DialogRecorder,
	type CommandRecorder,
	type PatchRecorder,
	type FluxRecorder,
	type MetroRecorder,
	type NativeRecorder,
	type PluginRecorder,
	type FsRecorder,
	type LogRecorder,
} from './recorders';
export { startPlugin, stopPlugin, pluginHolds } from './plugin-lifecycle';
export { render, type RenderOptions, type RenderResult } from './render';
export { fakeAssetId, type StoreSeeds } from './fake-api';
export type { PluginTypes } from './plugin-types';
