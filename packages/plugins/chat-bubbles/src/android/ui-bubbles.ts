import type {
	NativeJavaAssociationKey,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';
import { javaReference, javaText } from '@unbound-plugins/shared/native/android/java-values';

export type BindGuard = {
	messageView: string;
	bindName: string;
	bindParameters: string[];
	idField: string;
	ours: NativeJavaAssociationKey;
	original: NativeJavaAssociationKey;
	drawnFor: NativeJavaAssociationKey;
};

type BindEvent = {
	self?: NativeJavaValue;
};

/**
 * @description Gives a reused row its own background back from a hook that runs on the UI thread right after Discord binds the row to a different message, so the old bubble is never drawn behind the new message; the bubble is placed again once the row settles.
 * @param scope The plugin's UI scope.
 * @param guard The message view class, its bind method and message id field, and the keys the bubble, the row's own background and the bubble's message are kept under.
 */
export function installBindGuard(scope: NativeUIScope, guard: BindGuard) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;

	hooks.hook(
		guard.messageView,
		guard.bindName,
		guard.bindParameters,
		{ notify: 'after' },
		(event: BindEvent) => {
			const row = javaReference(event.self);

			if (!row) {
				return;
			}

			try {
				if (!javaReference(java.getAssociatedObject(row, guard.ours))) {
					return;
				}

				const shown = javaText(java.getField(row, guard.idField));
				const drawnFor = javaText(java.getAssociatedObject(row, guard.drawnFor));

				if (shown && shown === drawnFor) {
					return;
				}

				const background = javaReference(java.getAssociatedObject(row, guard.original));

				java.setAssociatedObject(row, guard.ours, { type: 'null' });
				java.invoke(row, 'setBackground', [
					background ?? { type: 'null', class: 'android.graphics.drawable.Drawable' },
				]);
			} catch (error) {
				console.error(`[Chat Bubbles] ${String(error)}`);
			}
		},
	);
}

export default { installBindGuard };
