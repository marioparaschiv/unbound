import type {
	NativeFabricBridge,
	NativeFabricSurface,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
} from '@unbound-app/api/native';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/safe-invoke';
import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { readFrame, readSize, setFrame, toRect } from '~/native/views';
import LatencyTooltip from '~/components/latency-tooltip';
import { placeTooltip, tooltipTextWidth } from '~/tooltip-layout';
import { Icon, Tooltip } from '~/constants';
import { Tooltips } from '~/modules';

export type TooltipAnchor = {
	cellKey: string;
	icon: NativeObjectHandle;
	tooltip: string;
};

export type TooltipController = {
	/** Shows the anchor's tooltip, replacing any open one. `isCurrent` reports whether the anchor is still on screen. */
	show(anchor: TooltipAnchor, isCurrent: () => boolean): void;
	dismissFor(cellKey: string): void;
	dispose(): Promise<void>;
};

type Shown = {
	host: NativeObjectHandle;
	surface: NativeFabricSurface;
	cellKey: string;
};

/**
 * @description Creates the tooltip shown when an indicator is tapped. It closes on the next touch or after a few seconds.
 * @param objc The Objective-C bridge from `context.native`.
 * @param fabric The Fabric bridge used to mount Discord's tooltip.
 * @returns The tooltip controller, or `null` when Discord's tooltip component is missing.
 */
export function createTooltips(
	objc: NativeObjCBridge,
	fabric: NativeFabricBridge,
): TooltipController | null {
	if (!ensureModules('Message Latency: tooltip', { Tooltips })) return null;

	const tasks = new Set<Promise<void>>();
	let shown: Shown | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let dismissHook: NativeHookToken | null = null;
	// Bumped on every dismiss, so a show that is still awaiting the bridge can tell it was superseded.
	let generation = 0;
	let disposed = false;
	let surfaceName: string | undefined;

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
					if (current === generation) track(dismiss());
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
					Tooltip.fontSize,
				)) as NativeObjectHandle | null)
			: null;

		if (!font) return null;

		await safeInvokeAsync(objc, label, 'setFont:', font);

		const size = objc.struct('CGSize', { width: maxWidth, height: 1000 });

		return readSize(await safeInvokeAsync(objc, label, 'sizeThatFits:', size));
	}

	async function show(anchor: TooltipAnchor, isCurrent: () => boolean) {
		await dismiss();

		const current = generation;
		const stale = () => disposed || current !== generation || !isCurrent();

		if (stale()) return;

		const uiWindow = (await safeInvokeAsync(
			objc,
			anchor.icon,
			'window',
		)) as NativeObjectHandle | null;
		const windowFrame = uiWindow
			? readFrame(await safeInvokeAsync(objc, uiWindow, 'bounds'))
			: null;

		if (!uiWindow || !windowFrame) return;

		let host: NativeObjectHandle | null = null;
		let surface: NativeFabricSurface | null = null;

		try {
			surfaceName ??= registerAppSurface('MessageLatencyTooltipSurface', LatencyTooltip);

			const moduleName = surfaceName;

			if (!moduleName) return;

			const text = await measure(anchor.tooltip, tooltipTextWidth(windowFrame.width));
			// The visible bars sit 4pt below the top of the taller tap target.
			const iconRect = toRect(objc, { x: 0, y: 4, width: Icon.width, height: Icon.height });
			const iconFrame = readFrame(
				await safeInvokeAsync(objc, anchor.icon, 'convertRect:toView:', iconRect, uiWindow),
			);
			const placement = text && iconFrame ? placeTooltip(text, iconFrame, windowFrame) : null;

			if (!placement) return;

			const { frame, below, arrowOffset } = placement;
			const size = { width: frame.width, height: frame.height };

			host = objc.alloc('UIView');
			await safeInvokeAsync(objc, host, 'setUserInteractionEnabled:', false);
			await safeInvokeAsync(
				objc,
				host,
				'setAccessibilityIdentifier:',
				'message-latency-tooltip',
			);
			await setFrame(objc, host, frame);

			if (stale()) return;

			await safeInvokeAsync(objc, uiWindow, 'addSubview:', host);

			if (stale()) return;

			surface = await fabric.mountAsync(host, moduleName, {
				arrowDirection: below ? 'UP' : 'DOWN',
				arrowOffset,
				label: anchor.tooltip,
				width: frame.width,
			});
			await fabric.setSizeAsync(surface, size, size);
			await fabric.setFrameAsync(surface, { x: 0, y: 0, ...size });

			if (stale()) return;

			shown = { host, surface, cellKey: anchor.cellKey };
			host = null;
			surface = null;
			// Deferred so the touch that opened the tooltip does not close it.
			setTimeout(() => closeOnNextTouch(current), 0);
			timer = setTimeout(() => {
				if (current === generation) track(dismiss());
			}, Tooltip.duration);
		} catch {
			if (current === generation) await dismiss();
		} finally {
			if (surface) await fabric.unmountAsync(surface).catch(() => undefined);

			if (host) await safeInvokeAsync(objc, host, 'removeFromSuperview');
		}
	}

	return {
		show: (anchor, isCurrent) => track(show(anchor, isCurrent)),
		dismissFor(cellKey) {
			if (shown?.cellKey === cellKey) track(dismiss());
		},
		async dispose() {
			disposed = true;
			await dismiss();
			await Promise.all([...tasks]);
		},
	};
}

export default { createTooltips };
