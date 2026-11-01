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
	messageIdGetter: string;
	hosts: NativeJavaAssociationKey;
	drawnFor: NativeJavaAssociationKey;
};

type BindEvent = {
	self?: NativeJavaValue;
	args?: NativeJavaValue[];
};

/**
 * @description Hides a row's reactor avatars from a hook that runs on the UI thread right after Discord binds the row to a different message, so the old message's reactors never show on the new one; new avatars are drawn for the new message.
 * @param scope The plugin's UI scope.
 * @param guard The message view class, its bind method and the getter of the bound message's id, and the keys the avatar hosts and their message are kept under.
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

				const message = event.args ? javaReference(event.args[0]) : null;
				const shown = message
					? javaText(java.invoke(message, guard.messageIdGetter, []))
					: undefined;
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
				console.error(`[Reaction Avatars] ${String(error)}`);
			}
		},
	);
}

export default { installRebindGuard };
