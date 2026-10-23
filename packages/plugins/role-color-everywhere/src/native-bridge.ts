import type { NativeObjCBridge, PluginContext } from '@unbound-app/api/native';

type NativeContext = Pick<PluginContext, 'platform'> & {
	native: Pick<PluginContext['native'], 'objc'>;
};

export function getNativeObjC(context?: NativeContext): NativeObjCBridge | null {
	return context?.platform === 'ios' ? context.native.objc : null;
}
