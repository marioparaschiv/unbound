import type {
	NativeJavaArgument,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUICallback,
	NativeUIScope,
} from '@unbound-app/api/native';

/** The method a main-thread proxy is passed to, as its last argument. */
export type ProxyAttachment = {
	target: NativeJavaReference;
	method: string;
	args: NativeJavaValue[];
};

/**
 * @description Makes a Java proxy on the main thread and passes it to a method there, answering each interface method synchronously from `answers` and reporting the call to the JS thread.
 * @param scope The plugin's UI scope, which removes the proxy on dispose.
 * @param interfaces The interfaces the proxy implements.
 * @param answers What each method returns at once on the main thread; a method not listed returns its type's default.
 * @param attachment The method that receives the proxy.
 * @param notify Receives each call's method name and arguments on the JS thread.
 * @returns The method's result.
 */
export function attachMainThreadProxy(
	scope: NativeUIScope,
	interfaces: string[],
	answers: Record<string, NativeJavaArgument>,
	attachment: ProxyAttachment,
	notify: NativeUICallback<[string, NativeJavaValue[]]>,
): NativeJavaValue | null {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const proxy = hooks.proxy(interfaces, (call) => {
		notify(call.method, call.args);

		return answers[call.method];
	});

	return java.invoke(attachment.target, attachment.method, [...attachment.args, proxy.object]);
}
