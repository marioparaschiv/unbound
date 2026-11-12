import type { NativeObjCInspector } from './native-objc';
import type { NativeBridge } from './native';

/** A {@link NativeBridge} namespace whose methods a plugin calls, such as `objc` or `java`. */
type NativeBridgeNamespace = Exclude<
	keyof NativeBridge,
	'apiVersion' | 'abiVersion' | 'capabilities' | 'ui'
>;

/** A native bridge method by the path a plugin calls it through, such as `objc.invoke`, or the debugger's `objc.inspect*`. */
export type NativeBridgeMethod =
	| {
			[N in NativeBridgeNamespace]: `${N}.${keyof NativeBridge[N] & string}`;
	  }[NativeBridgeNamespace]
	| `objc.${keyof NativeObjCInspector}`;

/**
 * The Capability each native bridge method needs; the source of every Capability name. Edit it, then run
 * `bun run generate-native-capabilities` to regenerate the client's and the loader's Capability lists.
 */
export const NATIVE_BRIDGE_METHOD_CAPABILITIES = {
	'objc.getClass': 'native.objc.classes',
	'objc.alloc': 'native.objc.classes',
	'objc.create': 'native.objc.invoke',
	'objc.className': 'native.objc.classes',
	'objc.respondsTo': 'native.objc.classes',
	'objc.call': 'native.objc.invoke',
	'objc.callSuper': 'native.objc.invoke',
	'objc.invoke': 'native.objc.invoke',
	'objc.prepare': 'native.objc.invoke',
	'objc.invokePrepared': 'native.objc.invoke',
	'objc.disposePlan': 'native.objc.invoke',
	'objc.invokeAsync': 'native.objc.invokeAsync',
	'objc.invokePreparedAsync': 'native.objc.invokeAsync',
	'objc.batch': 'native.objc.batch',
	'objc.snapshot': 'native.objc.snapshot',
	'objc.findViews': 'native.objc.snapshot',
	'objc.invokeSuper': 'native.objc.invoke',
	'objc.invokeSuperAsync': 'native.objc.invokeAsync',
	'objc.getIvar': 'native.objc.ivars',
	'objc.setIvar': 'native.objc.ivars',
	'objc.createAssociationKey': 'native.objc.associations',
	'objc.getAssociatedObject': 'native.objc.associations',
	'objc.setAssociatedObject': 'native.objc.associations',
	'objc.struct': 'native.objc.classes',
	'objc.array': 'native.objc.classes',
	'objc.data': 'native.objc.classes',
	'objc.hook': 'native.objc.hooks',
	'objc.inspectClass': 'native.objc.inspect',
	'objc.inspectMembers': 'native.objc.inspect',
	'objc.inspectValues': 'native.objc.inspect',
	'objc.inspectImages': 'native.objc.inspect',
	'objc.inspectClasses': 'native.objc.inspect',
	'ffi.symbol': 'native.ffi.symbols',
	'ffi.call': 'native.ffi.call',
	'fabric.mount': 'native.fabric.mount',
	'fabric.update': 'native.fabric.mount',
	'fabric.setSize': 'native.fabric.mount',
	'fabric.setFrame': 'native.fabric.mount',
	'fabric.measure': 'native.fabric.mount',
	'fabric.unmount': 'native.fabric.mount',
	'fabric.releaseIdle': 'native.fabric.mount',
	'fabric.mountAsync': 'native.fabric.async',
	'fabric.updateAsync': 'native.fabric.async',
	'fabric.setSizeAsync': 'native.fabric.async',
	'fabric.setFrameAsync': 'native.fabric.async',
	'fabric.batchAsync': 'native.fabric.async',
	'fabric.measureAsync': 'native.fabric.async',
	'fabric.unmountAsync': 'native.fabric.async',
	'fabric.releaseIdleAsync': 'native.fabric.async',
	'runtime.subscribe': 'native.runtime.events',
	'java.getClass': 'native.java.classes',
	'java.className': 'native.java.classes',
	'java.describe': 'native.java.classes',
	'java.construct': 'native.java.construct',
	'java.respondsTo': 'native.java.classes',
	'java.invoke': 'native.java.invoke',
	'java.invokeAsync': 'native.java.invokeAsync',
	'java.prepare': 'native.java.invoke',
	'java.invokePrepared': 'native.java.invoke',
	'java.invokePreparedAsync': 'native.java.invokeAsync',
	'java.disposePlan': 'native.java.invoke',
	'java.getField': 'native.java.fields',
	'java.setField': 'native.java.fields',
	'java.release': 'native.java.classes',
	'java.batch': 'native.java.batch',
	'java.batchAsync': 'native.java.batch',
	'java.findViews': 'native.java.invoke',
	'java.createAssociationKey': 'native.java.associations',
	'java.getAssociatedObject': 'native.java.associations',
	'java.setAssociatedObject': 'native.java.associations',
	'debug.recordEvaluation': 'native.debug.evaluations',
	'debug.environment': 'native.debug.environment',
	'hooks.hook': 'native.java.hooks',
	'hooks.setReturnValue': 'native.java.hooks',
	'hooks.removeReturnValue': 'native.java.hooks',
	'hooks.clearReturnValues': 'native.java.hooks',
	'hooks.remove': 'native.java.hooks',
	'hooks.proxy': 'native.java.hooks',
} as const satisfies Record<NativeBridgeMethod, `native.${string}.${string}`>;

/** A named permission to use one part of the native bridge, declared in an addon's manifest. */
export type NativeBridgeCapability = (typeof NATIVE_BRIDGE_METHOD_CAPABILITIES)[NativeBridgeMethod];
