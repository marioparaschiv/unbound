import type {
	NativeBridge,
	NativeFabricFrame as Frame,
	NativeFabricSurface,
	NativeHookToken,
	NativeObjectHandle,
} from '@unbound-app/api/native';
import { parseRect, parseSize, toRect } from '@unbound-plugins/shared/native/ios/rect';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/ios/safe-invoke';
import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import { layoutTooltipSurface } from '@unbound-plugins/shared/tooltips/tooltip-surface';
import {
	placeTooltip,
	tooltipTextWidth,
	TooltipStyle,
} from '@unbound-plugins/shared/tooltips/tooltip-layout';
import TooltipBubble from '@unbound-plugins/shared/tooltips/tooltip-bubble';

export type IOSTooltipAnchor = {
	/** Names what the tooltip belongs to, so `dismissFor` can close it. */
	key: string;
	text: string;
	/** Finds the window the tooltip opens in. */
	window(): Promise<NativeObjectHandle | null>;
	/** Finds the anchor's frame in that window's coordinates. */
	frame(window: NativeObjectHandle): Promise<Frame | null>;
};

export type IOSTooltips = {
	/** Shows the anchor's tooltip, replacing any open one. `isCurrent` reports whether the anchor is still on screen. */
	show(anchor: IOSTooltipAnchor, isCurrent?: () => boolean): void;
	dismissFor(key: string): void;
	dispose(): Promise<void>;
};

type Native = Pick<NativeBridge, 'objc' | 'fabric'>;

type Shown = {
	host: NativeObjectHandle;
	surface: NativeFabricSurface;
	key: string;
};

/**
 * @description Creates tooltips in Discord's colors over the window, closed by the next touch or after a few seconds.
 * @param native The `context.native` bridge: its Objective-C bridge, and Fabric bridge to mount the tooltip.
 * @param surfaceKey The plugin's own name for the tooltip's app surface.
 * @returns The tooltip controller.
 */
export function createIOSTooltips({ objc, fabric }: Native, surfaceKey: string): IOSTooltips {
	const tasks = new Set<Promise<void>>();
	let shown: Shown | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let dismissHook: NativeHookToken | null = null;
	let generation = 0;
	let disposed = false;
	let surfaceName: string | undefined;
	let queue: Promise<void> = Promise.resolve();
	let opening: string | null = null;

	function track(task: Promise<void>) {
		const settled = task.catch(() => undefined);

		tasks.add(settled);
		void settled.finally(() => tasks.delete(settled));
	}

	async function dismiss() {
		if (timer) clearTimeout(timer);

		timer = null;
		generation++;
		dismissHook?.remove();
		dismissHook = null;

		const previous = shown;

		shown = null;

		if (!previous) return;

		await fabric.unmountAsync(previous.surface).catch(() => undefined);
		await safeInvokeAsync(objc, previous.host, 'removeFromSuperview');
	}

	function closeOnNextTouch(current: number) {
		if (!shown || dismissHook || current !== generation) return;

		try {
			dismissHook = objc.hook('UIWindow', 'sendEvent:', {
				after: () => {
					if (current === generation) setTimeout(() => track(dismiss()), 0);
				},
			});
		} catch {
			// Without the hook the timer still closes the tooltip.
		}
	}

	async function measure(text: string, maxWidth: number) {
		const label = objc.alloc('UILabel');

		await safeInvokeAsync(objc, label, 'setText:', text);
		await safeInvokeAsync(objc, label, 'setNumberOfLines:', 0);

		const UIFont = objc.getClass('UIFont');
		const font = UIFont
			? ((await safeInvokeAsync(
					objc,
					UIFont,
					'systemFontOfSize:',
					TooltipStyle.fontSize,
				)) as NativeObjectHandle | null)
			: null;

		if (!font) return null;

		await safeInvokeAsync(objc, label, 'setFont:', font);

		const size = objc.struct('CGSize', { width: maxWidth, height: 1000 });

		return parseSize(await safeInvokeAsync(objc, label, 'sizeThatFits:', size)) ?? null;
	}

	async function show(anchor: IOSTooltipAnchor, isCurrent: () => boolean) {
		await dismiss();

		const current = generation;
		const stale = () => disposed || current !== generation || !isCurrent();

		if (stale()) return;

		const uiWindow = await anchor.window();
		const windowFrame = uiWindow
			? (parseRect(await safeInvokeAsync(objc, uiWindow, 'bounds')) ?? null)
			: null;

		if (!uiWindow || !windowFrame) return;

		let host: NativeObjectHandle | null = null;
		let surface: NativeFabricSurface | null = null;

		try {
			surfaceName ??= registerAppSurface(surfaceKey, TooltipBubble);

			const moduleName = surfaceName;

			if (!moduleName) return;

			const text = await measure(anchor.text, tooltipTextWidth(windowFrame.width));
			const anchorFrame = await anchor.frame(uiWindow);
			const placement =
				text && anchorFrame ? placeTooltip(text, anchorFrame, windowFrame) : null;

			if (!placement) return;

			const { frame, below, arrowOffset } = placement;
			const size = { width: frame.width, height: frame.height };

			host = objc.alloc('UIView');
			await safeInvokeAsync(objc, host, 'setUserInteractionEnabled:', false);
			await safeInvokeAsync(objc, host, 'setAccessibilityIdentifier:', surfaceKey);
			await safeInvokeAsync(objc, host, 'setFrame:', toRect(objc, frame));

			if (stale()) return;

			await safeInvokeAsync(objc, uiWindow, 'addSubview:', host);

			if (stale()) return;

			surface = await fabric.mountAsync(host, moduleName, {
				arrowDirection: below ? 'UP' : 'DOWN',
				arrowOffset,
				label: anchor.text,
				width: frame.width,
			});
			await layoutTooltipSurface(fabric, surface, size);

			if (stale()) return;

			shown = { host, surface, key: anchor.key };
			host = null;
			surface = null;
			// Deferred so the touch that opened the tooltip does not close it.
			setTimeout(() => closeOnNextTouch(current), 0);
			timer = setTimeout(() => {
				if (current === generation) track(dismiss());
			}, TooltipStyle.duration);
		} catch {
			if (current === generation) await dismiss();
		} finally {
			if (surface) await fabric.unmountAsync(surface).catch(() => undefined);

			if (host) await safeInvokeAsync(objc, host, 'removeFromSuperview');
		}
	}

	function enqueueShow(anchor: IOSTooltipAnchor, isCurrent: () => boolean) {
		if (opening === anchor.key || shown?.key === anchor.key) return;

		opening = anchor.key;
		queue = queue
			.then(() => show(anchor, isCurrent))
			.catch(() => undefined)
			.finally(() => {
				if (opening === anchor.key) opening = null;
			});
		track(queue);
	}

	return {
		show: (anchor, isCurrent = () => true) => enqueueShow(anchor, isCurrent),
		dismissFor(key) {
			if (shown?.key === key) track(dismiss());
		},
		async dispose() {
			disposed = true;
			await dismiss();
			await Promise.all([...tasks]);
		},
	};
}

export default { createIOSTooltips };
