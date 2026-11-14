import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

const COVER_TAG = 0x5052_4956;
const BLUR_DARK = 2;
const FLEXIBLE_SIZE = 18;

function keyWindow(objc: NativeObjCBridge): NativeObjectHandle | null {
	'worklet';
	const app = objc.call(
		objc.getClass('UIApplication') as NativeObjectHandle,
		'sharedApplication',
	) as NativeObjectHandle;

	return objc.invoke(app, 'keyWindow', []) as NativeObjectHandle | null;
}

function cover(objc: NativeObjCBridge) {
	'worklet';
	const window = keyWindow(objc);

	if (!window || objc.invoke(window, 'viewWithTag:', [COVER_TAG])) return;

	const effect = objc.call(
		objc.getClass('UIBlurEffect') as NativeObjectHandle,
		'effectWithStyle:',
		BLUR_DARK,
	);
	const view = objc.invoke(
		objc.call(
			objc.getClass('UIVisualEffectView') as NativeObjectHandle,
			'alloc',
		) as NativeObjectHandle,
		'initWithEffect:',
		[effect],
	) as NativeObjectHandle | null;

	if (!view) return;

	objc.invoke(view, 'setTag:', [COVER_TAG]);
	objc.invoke(view, 'setFrame:', [objc.invoke(window, 'bounds', [])]);
	objc.invoke(view, 'setAutoresizingMask:', [FLEXIBLE_SIZE]);
	objc.invoke(window, 'addSubview:', [view]);
}

function uncover(objc: NativeObjCBridge) {
	'worklet';
	const window = keyWindow(objc);
	const view = window
		? (objc.invoke(window, 'viewWithTag:', [COVER_TAG]) as NativeObjectHandle | null)
		: null;

	if (view) objc.invoke(view, 'removeFromSuperview', []);
}

/**
 * @description Blurs Discord's window when its scene resigns active, before iOS snapshots it for the app switcher, and
 * clears the blur when it becomes active again.
 * @param scope The plugin's UI scope, whose hooks end with it.
 * @returns Whether the scene delegate was found.
 */
export function installPrivacyCover(scope: NativeUIScope): boolean {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	if (!objc.getClass('SceneDelegate')) return false;

	objc.hook('SceneDelegate', 'sceneWillResignActive:', { after: () => cover(objc) });
	objc.hook('SceneDelegate', 'sceneDidBecomeActive:', { after: () => uncover(objc) });

	return true;
}

/**
 * @description Removes the blur, if one is up.
 * @param scope The plugin's UI scope.
 */
export function removePrivacyCover(scope: NativeUIScope) {
	'worklet';
	uncover(scope.objc as NativeObjCBridge);
}

/**
 * @description Puts the blur up and takes it down again, reporting whether it reached the window.
 * @param scope The plugin's UI scope.
 * @returns Whether the blur showed.
 */
export function testPrivacyCover(scope: NativeUIScope): boolean {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;

	cover(objc);

	const window = keyWindow(objc);
	const shown = Boolean(window && objc.invoke(window, 'viewWithTag:', [COVER_TAG]));

	uncover(objc);

	return shown;
}
