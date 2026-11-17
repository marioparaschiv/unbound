/**
 * @description Logs an error a UI worklet caught, unless it only means the plugin's UI scope was disposed while the
 * worklet ran, which happens whenever a plugin stops mid-layout. Runs on the UI thread.
 * @param plugin The plugin's name, prefixed to the line.
 * @param error The caught error.
 */
export function reportWorkletError(plugin: string, error: unknown): void {
	'worklet';
	if (Reflect.get(Object(error), 'code') === 'NATIVE_PLUGIN_SCOPE_DISPOSED') {
		return;
	}

	console.error(`[${plugin}] ${String(error)}`);
}

export default reportWorkletError;
