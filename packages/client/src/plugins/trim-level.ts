import type { NativeJavaValue } from '@unbound-app/types';

const TRIM_MEMORY_RUNNING_LOW = 10;

/**
 * @description Reads Android's trim level from an `onTrimMemory` call and tells whether it asks to free memory.
 * @param level The trim level Android passed, as the Java bridge hands it over.
 * @returns Whether it is `TRIM_MEMORY_RUNNING_LOW` or more.
 */
export function isMemoryPressure(level: NativeJavaValue | undefined): boolean {
	return level?.type === 'int' && level.value >= TRIM_MEMORY_RUNNING_LOW;
}
