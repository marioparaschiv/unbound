// `createDevicePrelude` runs on the device through `toDeviceCode`, so it may not reach outside its own body.
import type {
	NativeJavaHandleValue,
	NativeJavaValue,
	NativePluginCapability,
	NativePluginPlatform,
	PluginContext,
} from '@unbound-app/api/native';
import type { AddonHandle, UnboundGlobal } from '@unbound-app/api/global';

/** A loaded plugin as the client's manager holds it: its handle, plus the native bridge the client keeps on it for device tooling. */
export type DevicePlugin = AddonHandle & { context?: PluginContext };

/** Unbound's plugin manager as device probes read it; clients that predate start timing lack `startDurations`. */
export type DevicePlugins = {
	entities: ReadonlyMap<PropertyKey, DevicePlugin>;
	startDurations?: ReadonlyMap<string, number>;
};

/** Readers for the values the Java bridge returns, and a writer for an `int` argument. */
export type JavaValues = {
	handle: (value: NativeJavaValue) => NativeJavaHandleValue | null;
	isTrue: (value: NativeJavaValue) => boolean;
	number: (value: NativeJavaValue) => number;
	string: (value: NativeJavaValue) => string;
	int: (value: number) => NativeJavaValue;
};

/** What every device probe receives first: Unbound's global and the helpers probes share. */
export type DevicePrelude = {
	unbound: UnboundGlobal;
	/** The plugin manager, or `undefined` before the client has initialized. */
	plugins: DevicePlugins | undefined;
	/** Borrows the native bridge of a running plugin on a platform that holds every capability. */
	nativeBridge: (
		platform: NativePluginPlatform,
		capabilities: readonly NativePluginCapability[],
	) => PluginContext | undefined;
	javaValues: JavaValues;
};

/**
 * @description Builds the helpers device probes share. Runs on the device through `toDeviceCode`, so it only uses its parameter.
 * @param unbound Unbound's global on the device.
 * @returns The prelude passed to a probe.
 */
export function createDevicePrelude(unbound: UnboundGlobal): DevicePrelude {
	const plugins: DevicePlugins | undefined = unbound.plugins;

	return {
		unbound,
		plugins,
		nativeBridge: (platform, capabilities) =>
			[...(plugins?.entities.values() ?? [])].find(
				(addon) =>
					addon.started &&
					addon.context?.platform === platform &&
					capabilities.every((capability) =>
						addon.context?.capabilities.includes(capability),
					),
			)?.context,
		javaValues: {
			handle: (value) => (value.type === 'handle' ? value : null),
			isTrue: (value) => 'value' in value && value.value === true,
			number: (value) =>
				'value' in value && typeof value.value === 'number' ? value.value : 0,
			string: (value) => (value.type === 'string' ? value.value : ''),
			int: (value) => ({ type: 'int', value }),
		},
	};
}

export default { createDevicePrelude };
