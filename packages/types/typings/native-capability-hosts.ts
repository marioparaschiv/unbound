import type { NativePluginCapability, NativePluginMethod } from './native-methods';
import type { NativePluginPlatform } from './native';

/**
 * Which platforms' loaders provide each Capability, in the order `NATIVE_PLUGIN_CAPABILITIES` lists them.
 * With {@link NATIVE_PLUGIN_METHOD_CAPABILITIES} it is the source `bun run generate-native-capabilities` reads.
 */
export const NATIVE_PLUGIN_CAPABILITY_PLATFORMS = {
	'native.objc.classes': ['ios'],
	'native.objc.invoke': ['ios'],
	'native.objc.invokeAsync': ['ios'],
	'native.objc.batch': ['ios'],
	'native.objc.snapshot': ['ios'],
	'native.objc.ivars': ['ios'],
	'native.objc.associations': ['ios'],
	'native.objc.hooks': ['ios'],
	'native.ffi.symbols': ['ios', 'android'],
	'native.ffi.call': ['ios', 'android'],
	'native.fabric.mount': ['ios'],
	'native.fabric.async': ['ios', 'android'],
	'native.runtime.events': ['ios', 'android'],
	'native.java.classes': ['android'],
	'native.java.construct': ['android'],
	'native.java.fields': ['android'],
	'native.java.invoke': ['android'],
	'native.java.invokeAsync': ['android'],
	'native.java.hooks': ['android'],
	'native.java.batch': ['android'],
	'native.java.associations': ['android'],
	'native.debug.evaluations': ['ios', 'android'],
	'native.debug.environment': ['ios', 'android'],
} as const satisfies Record<NativePluginCapability, readonly NativePluginPlatform[]>;

/** The methods the client implements in JavaScript, so the loader's bridge need not install them. */
export const NATIVE_PLUGIN_CLIENT_METHODS = [
	'objc.create',
	'runtime.subscribe',
] as const satisfies readonly NativePluginMethod[];
