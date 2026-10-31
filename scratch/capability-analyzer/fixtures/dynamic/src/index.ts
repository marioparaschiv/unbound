import type { NativeObjCBridge, PluginContext } from '@unbound-app/api/native';

import { paint } from './ios/paint';

let objc: NativeObjCBridge | undefined;

function helper(bridge: Pick<NativeObjCBridge, 'invoke'>) {
	return bridge.invoke;
}

function sink(value: unknown) {
	return value;
}

export function start(context: PluginContext, name: string) {
	objc = context.native.objc;

	// Static, accepted.
	objc.invoke('a', 'b', []);
	const alias = objc;
	alias.getIvar('a', 'b');
	const { snapshot } = objc;
	void snapshot;
	void objc['hook'];
	helper(objc);
	paint(context.native.java);

	// Dynamic, rejected.
	void objc[name as 'invoke'];
	const { [name]: picked } = objc as unknown as Record<string, unknown>;
	void picked;
	const { invoke, ...rest } = objc;
	void invoke;
	void rest;
	void { ...objc };
	void Object.keys(objc);
	sink(objc);
	const anyObjc: any = objc;
	anyObjc.batch([]);
	void (objc as any).setIvar;
	for (const key in objc) void key;
	void context.native[name as 'objc'];
	void import(`./ios/${name}`);
}
