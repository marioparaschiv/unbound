import { findViewerPlayerLayer } from '@unbound-plugins/shared/media-viewer/ios/player-layer';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/ios/safe-invoke';
import type { NativeBridge, NativeHandle } from '@unbound-app/api/native';

const TOUCH_UP_INSIDE = 1 << 6;
const BUTTON_SEARCH = { maxDepth: 4, maxResults: 1 } as const;

export type AirPlay = {
	/** Lets the media viewer's video play on an AirPlay device and opens the system device picker. */
	pick(): Promise<'opened' | 'no-video' | 'failed'>;
	dispose(): void;
};

function asHandle(value: unknown): NativeHandle | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as NativeHandle)
		: null;
}

/**
 * @description AirPlay for the media viewer on iOS: finds the viewer's `AVPlayer`, allows external playback on it,
 * and presses an invisible `AVRoutePickerView` in the key window so iOS shows its own AirPlay device list.
 * @param native The plugin's native bridge.
 * @returns The AirPlay controller.
 */
export function createAirPlay({ objc }: NativeBridge): AirPlay {
	let picker: NativeHandle | null = null;

	async function keyWindow(): Promise<NativeHandle | null> {
		const UIApplication = objc.getClass('UIApplication');
		const app = UIApplication
			? asHandle(await safeInvokeAsync(objc, UIApplication, 'sharedApplication'))
			: null;

		return app ? asHandle(await safeInvokeAsync(objc, app, 'keyWindow')) : null;
	}

	async function attachedPicker(): Promise<NativeHandle | null> {
		const window = await keyWindow();

		if (!window) return null;

		picker ??= asHandle(
			objc.create('AVRoutePickerView', 'initWithFrame:', [
				objc.struct('CGRect', { origin: { x: 0, y: 0 }, size: { width: 1, height: 1 } }),
			]),
		);

		if (!picker) return null;

		await safeInvokeAsync(objc, picker, 'setAlpha:', 0.01);
		await safeInvokeAsync(objc, picker, 'setPrioritizesVideoDevices:', true);
		await safeInvokeAsync(objc, window, 'addSubview:', picker);

		return picker;
	}

	async function press(view: NativeHandle): Promise<boolean> {
		const [button] = await objc.findViews(view, 'UIButton', BUTTON_SEARCH).catch(() => []);
		const handle = asHandle(button);

		if (!handle) return false;

		await safeInvokeAsync(objc, handle, 'sendActionsForControlEvents:', TOUCH_UP_INSIDE);

		return true;
	}

	return {
		async pick() {
			try {
				const layer = await findViewerPlayerLayer(objc);
				const player = layer
					? asHandle(await safeInvokeAsync(objc, layer, 'player'))
					: null;

				if (!player) return 'no-video';

				await safeInvokeAsync(objc, player, 'setAllowsExternalPlayback:', true);
				await safeInvokeAsync(
					objc,
					player,
					'setUsesExternalPlaybackWhileExternalScreenIsActive:',
					true,
				);

				const view = await attachedPicker();

				return view && (await press(view)) ? 'opened' : 'failed';
			} catch (error) {
				logger.error('Failed to open the AirPlay picker:', error);

				return 'failed';
			}
		},
		dispose() {
			if (picker) void safeInvokeAsync(objc, picker, 'removeFromSuperview');

			picker = null;
		},
	};
}
