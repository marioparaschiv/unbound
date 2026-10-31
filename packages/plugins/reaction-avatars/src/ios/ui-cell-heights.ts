import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

const STATE_KEY = '__unboundReactionAvatarHeights';

type BoxedSize = {
	value?: BoxedSize;
	width?: number;
	height?: number;
};

type HeightState = {
	objc: NativeObjCBridge;
	floors: Map<string, number>;
};

type StateHolder = Record<typeof STATE_KEY, HeightState | undefined>;

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function cellKey(objc: NativeObjCBridge, cell: NativeObjectHandle): string {
	'worklet';

	return `${objc.className(cell) ?? 'NSObject'}:${String(objc.call(cell, 'hash'))}`;
}

/**
 * @description Raises message cells to the height their reflowed reactions need, from one `sizeThatFits:` replacement that runs on the UI thread, so measuring a cell never waits on the JS thread.
 * @param scope The plugin's UI scope.
 * @param messageCell The message cell class.
 */
export function installHeightHook(scope: NativeUIScope, messageCell: string) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const current: HeightState = { objc, floors: new Map() };

	holder()[STATE_KEY] = current;

	objc.hook(messageCell, 'sizeThatFits:', {
		replace(context) {
			const size = context.original.apply(undefined, context.args) as BoxedSize | null;

			if (!current.floors.size) {
				return size;
			}

			const floor = current.floors.get(cellKey(objc, context.self));
			const natural = size?.value ?? size;
			const width = Number(natural?.width);
			const height = Number(natural?.height);

			if (floor === undefined || !Number.isFinite(height) || height >= floor) {
				return size;
			}

			return objc.struct('CGSize', { width, height: floor });
		},
	});
}

/**
 * @description Sets the height a message cell must at least be measured at.
 * @param key The cell's view key.
 * @param floor The minimum height in points.
 */
export function setCellFloor(key: string, floor: number) {
	'worklet';
	holder()[STATE_KEY]?.floors.set(key, floor);
}

/**
 * @description Lets a message cell be measured at its natural height again.
 * @param key The cell's view key.
 */
export function clearCellFloor(key: string) {
	'worklet';
	holder()[STATE_KEY]?.floors.delete(key);
}

/**
 * @description Lets every message cell be measured at its natural height again.
 */
export function clearCellFloors() {
	'worklet';
	holder()[STATE_KEY]?.floors.clear();
}

export default { installHeightHook, setCellFloor, clearCellFloor, clearCellFloors };
