import type {
	NativeJavaAssociationKey,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

const INVISIBLE = 4;

export type RebindGuard = {
	messageView: string;
	bindName: string;
	bindParameters: string[];
	/** The row's field holding the id of the message it shows, which the bind sets. */
	idField: string;
	/** The key a `java.util.List` of the views drawn on the row is kept under. */
	hosts: NativeJavaAssociationKey;
	/** The key the id of the message those views were drawn for is kept under. */
	drawnFor: NativeJavaAssociationKey;
	/** Names the plugin in a log line. */
	label: string;
};

type BindEvent = {
	self?: NativeJavaValue;
};

/**
 * @description Hides the views a plugin drew on a message row from a hook that runs on the UI thread right after Discord binds the row to a different message, so the old message's drawing never shows on the new one.
 * @param scope The plugin's UI scope.
 * @param guard The message view class, its bind method and id field, the keys the drawn views and their message are kept under, and the plugin's name.
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
				const hosts = javaReference(java.getAssociatedObject(row, guard.hosts));

				if (!hosts) {
					return;
				}

				const shown = javaText(java.getField(row, guard.idField));
				const drawnFor = javaText(java.getAssociatedObject(row, guard.drawnFor));

				if (shown && shown === drawnFor) {
					return;
				}

				const count = javaNumber(java.invoke(hosts, 'size', [])) ?? 0;

				for (let index = 0; index < count; index++) {
					const host = javaReference(java.invoke(hosts, 'get', [javaInt(index)]));

					if (host) {
						java.invoke(host, 'setVisibility', [javaInt(INVISIBLE)]);
					}
				}
			} catch (error) {
				console.error(
					`[${guard.label}] Failed to hide a rebound row's views: ${String(error)}`,
				);
			}
		},
	);
}

export default { installRebindGuard };
