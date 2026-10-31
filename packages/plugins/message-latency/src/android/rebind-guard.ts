import type {
	NativeJavaAssociationKey,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaInt,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

const INVISIBLE = 4;

export type RebindGuard = {
	messageView: string;
	bindName: string;
	bindParameters: string[];
	idField: string;
	host: NativeJavaAssociationKey;
	drawnFor: NativeJavaAssociationKey;
};

type BindEvent = {
	self?: NativeJavaValue;
};

/**
 * @description Hides a row's latency icon from a hook that runs on the UI thread right after Discord binds the row to a different message, so the old message's latency never shows on the new one; the icon shows again once it is drawn for the new message.
 * @param scope The plugin's UI scope.
 * @param guard The message view class, its bind method and message id field, and the keys the icon's host and its message are kept under.
 */
export function installRebindGuard(scope: NativeUIScope, guard: RebindGuard) {
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
				const host = javaReference(java.getAssociatedObject(row, guard.host));

				if (!host) {
					return;
				}

				const shown = javaText(java.getField(row, guard.idField));
				const drawnFor = javaText(java.getAssociatedObject(row, guard.drawnFor));

				if (!shown || shown !== drawnFor) {
					java.invoke(host, 'setVisibility', [javaInt(INVISIBLE)]);
				}
			} catch (error) {
				console.error(`[Message Latency] ${String(error)}`);
			}
		},
	);
}

export default { installRebindGuard };
