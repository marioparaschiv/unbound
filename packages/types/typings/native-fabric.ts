import type {
	NativeCancelablePromise,
	NativeHandle,
	NativeObjectHandle,
	NativeSerializableObject,
} from './native-handles';

/** A Fabric surface size, in points on iOS and dp on Android, between 0 and 32,768. */
export type NativeFabricSize = {
	/** Width, in points on iOS and dp on Android. */
	width: number;
	/** Height, in points on iOS and dp on Android. */
	height: number;
};

/** A view's frame in its container, in points on iOS and dp on Android. */
export type NativeFabricFrame = {
	/** The left edge, between -100,000 and 100,000. */
	x: number;
	/** The top edge, between -100,000 and 100,000. */
	y: number;
	/** Width, between 0 and 32,768. */
	width: number;
	/** Height, between 0 and 32,768. */
	height: number;
};

/** A mounted Fabric surface; the plugin scope unmounts it on dispose. */
export type NativeFabricSurface = NativeHandle;

/** Mounts registered React Native components inside existing native views. Sync methods are iOS only. */
export type NativeFabricBridge = {
	/** Starts a surface for a registered component inside a container view. Needs `native.fabric.mount`. */
	mount(
		container: NativeObjectHandle,
		moduleName: string,
		properties?: NativeSerializableObject,
	): NativeFabricSurface;
	/** Like `mount`, on the main thread. Needs `native.fabric.async`. */
	mountAsync(
		container: NativeObjectHandle,
		moduleName: string,
		properties?: NativeSerializableObject,
	): NativeCancelablePromise<NativeFabricSurface>;
	/** Sends new properties to a surface. */
	update(surface: NativeFabricSurface, properties: NativeSerializableObject): void;
	/** Like `update`, on the main thread. */
	updateAsync(
		surface: NativeFabricSurface,
		properties: NativeSerializableObject,
	): NativeCancelablePromise<void>;
	/** Sets the smallest and largest size the surface may lay out at. */
	setSize(
		surface: NativeFabricSurface,
		minimumSize: NativeFabricSize,
		maximumSize: NativeFabricSize,
	): void;
	/** Like `setSize`, on the main thread. */
	setSizeAsync(
		surface: NativeFabricSurface,
		minimumSize: NativeFabricSize,
		maximumSize: NativeFabricSize,
	): NativeCancelablePromise<void>;
	/** Positions the surface's view in its container. */
	setFrame(surface: NativeFabricSurface, frame: NativeFabricFrame): void;
	/** Like `setFrame`, on the main thread. */
	setFrameAsync(
		surface: NativeFabricSurface,
		frame: NativeFabricFrame,
	): NativeCancelablePromise<void>;
	/** Reads a view's frame. */
	measure(view: NativeObjectHandle): NativeFabricFrame;
	/** Like `measure`, on the main thread. */
	measureAsync(view: NativeObjectHandle): NativeCancelablePromise<NativeFabricFrame>;
	/** Stops a surface and removes its view. */
	unmount(surface: NativeFabricSurface): void;
	/** Like `unmount`, on the main thread. */
	unmountAsync(surface: NativeFabricSurface): NativeCancelablePromise<void>;
};
