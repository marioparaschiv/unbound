import type { NativeJavaBridge, NativeJavaReference, NativeUIScope } from '@unbound-app/api/native';
import { javaInt, javaReference } from '@unbound-plugins/shared/native/android/java-values';

const FLAG_SECURE = 8192;

function trackedActivity(java: NativeJavaBridge, tracker: NativeJavaReference) {
	'worklet';

	try {
		return javaReference(java.invoke(tracker, 'lastActivity', []));
	} catch {
		return javaReference(java.invoke(tracker, 'currentActivity', []));
	}
}

function activityWindow(java: NativeJavaBridge) {
	'worklet';
	const tracker = javaReference(
		java.getField(java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE'),
	);
	const activity = tracker ? trackedActivity(java, tracker) : null;

	return activity ? javaReference(java.invoke(activity, 'getWindow', [])) : null;
}

/**
 * @description Marks Discord's window secure, or not, which blanks its app switcher preview and blocks screenshots.
 * @param scope The plugin's UI scope.
 * @param secure Whether the window is secure.
 * @returns Whether a window was found.
 */
export function setSecureWindow(scope: NativeUIScope, secure: boolean): boolean {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const window = activityWindow(java);

	if (!window) return false;

	java.invoke(window, secure ? 'addFlags' : 'clearFlags', [javaInt(FLAG_SECURE)]);

	return true;
}
