import type {
	NativeFabricBridge,
	NativeFabricSurface,
	NativeJavaBridge,
	NativeJavaHandle,
	NativeJavaHookToken,
	NativeJavaHooksBridge,
	NativeJavaReference,
} from '@unbound-app/api/native';
import {
	createHost,
	placeHost,
	removeHost,
} from '@unbound-plugins/shared/native/android/inline-hosts';
import {
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';
import { currentDecorView } from '@unbound-plugins/shared/native/android/views';
import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { placeTooltip, tooltipTextWidth } from '~/tooltip-layout';
import LatencyTooltip from '~/components/latency-tooltip';
import { Icon, Tooltip } from '~/constants';
import { Tooltips } from '~/modules';

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	fabric: NativeFabricBridge;
};

export type AndroidTooltipAnchor = {
	key: string;
	host: NativeJavaReference;
	tooltip: string;
};

export type AndroidTooltips = {
	show(anchor: AndroidTooltipAnchor): void;
	dismissFor(key: string): void;
	dispose(): Promise<void>;
};

type Shown = {
	key: string;
	host: NativeJavaHandle;
	surface: NativeFabricSurface;
};

type Metrics = {
	density: number;
	scaledDensity: number;
};

/**
 * @description Creates the tooltip shown when an Android indicator is tapped, Discord's tooltip on its own surface over the window. It closes on the next touch or after a few seconds, like the iOS one.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @returns The tooltip controller, or `null` when Discord's tooltip component is missing.
 */
export function createAndroidTooltips({ java, hooks, fabric }: Native): AndroidTooltips | null {
	if (!ensureModules('Message Latency: tooltip', { Tooltips })) return null;

	const tasks = new Set<Promise<void>>();
	let shown: Shown | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let dismissHook: NativeJavaHookToken | null = null;
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

		if (dismissHook) hooks.remove(dismissHook);

		dismissHook = null;

		const previous = shown;

		shown = null;

		if (!previous) return;

		await fabric.unmountAsync(previous.surface).catch(() => undefined);
		await removeHost(java, previous.host).catch(() => undefined);
	}

	function closeOnNextTouch(current: number) {
		if (!shown || dismissHook || current !== generation) return;

		try {
			dismissHook = hooks.hook(
				'android.app.Activity',
				'dispatchTouchEvent',
				['android.view.MotionEvent'],
				{ notify: true },
				() => {
					if (current === generation) track(dismiss());
				},
			);
		} catch {
			dismissHook = null;
		}
	}

	function metricsOf(view: NativeJavaReference): Metrics {
		const resources = javaReference(java.invoke(view, 'getResources', []));
		const metrics = resources
			? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
			: null;
		const density = metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;

		return {
			density,
			scaledDensity: metrics
				? (javaNumber(java.getField(metrics, 'scaledDensity')) ?? density)
				: density,
		};
	}

	function measure(text: string, maxWidth: number, metrics: Metrics) {
		const paint = java.construct('android.text.TextPaint', []);

		java.invoke(paint, 'setTextSize', [javaFloat(Tooltip.fontSize * metrics.scaledDensity)]);

		const builder = java.invoke(java.getClass('android.text.StaticLayout$Builder'), 'obtain', [
			javaString(text),
			javaInt(0),
			javaInt(text.length),
			paint,
			javaInt(Math.round(maxWidth * metrics.density)),
		]);
		const layout = javaReference(builder) ? java.invoke(builder, 'build', []) : null;

		if (!javaReference(layout)) return null;

		const lines = javaNumber(java.invoke(layout, 'getLineCount', [])) ?? 0;
		let width = 0;

		for (let line = 0; line < lines; line++) {
			width = Math.max(
				width,
				javaNumber(java.invoke(layout, 'getLineWidth', [javaInt(line)])) ?? 0,
			);
		}

		return {
			width: Math.ceil(width) / metrics.density,
			height: (javaNumber(java.invoke(layout, 'getHeight', [])) ?? 0) / metrics.density,
		};
	}

	function iconFrame(host: NativeJavaReference, density: number) {
		const rect = java.construct('android.graphics.Rect', []);

		java.invoke(host, 'getGlobalVisibleRect', [rect]);

		return {
			x: (javaNumber(java.getField(rect, 'left')) ?? 0) / density,
			y: (javaNumber(java.getField(rect, 'top')) ?? 0) / density + 4,
			width: Icon.width,
			height: Icon.height,
		};
	}

	async function show(anchor: AndroidTooltipAnchor) {
		await dismiss();

		const current = generation;
		const stale = () => disposed || current !== generation;
		const decor = currentDecorView(java);

		if (stale() || !decor) return;

		surfaceName ??= registerAppSurface('MessageLatencyTooltipSurface', LatencyTooltip);

		if (!surfaceName) return;

		const metrics = metricsOf(decor);
		const bounds = {
			x: 0,
			y: 0,
			width: (javaNumber(java.invoke(decor, 'getWidth', [])) ?? 0) / metrics.density,
			height: (javaNumber(java.invoke(decor, 'getHeight', [])) ?? 0) / metrics.density,
		};
		const text = measure(anchor.tooltip, tooltipTextWidth(bounds.width), metrics);
		const placement = text
			? placeTooltip(text, iconFrame(anchor.host, metrics.density), bounds)
			: null;

		if (!placement) return;

		const { frame, below, arrowOffset } = placement;
		const position = { x: frame.x * metrics.density, y: frame.y * metrics.density };
		const size = {
			width: frame.width * metrics.density,
			height: frame.height * metrics.density,
		};
		const host = createHost(java, decor);
		let surface: NativeFabricSurface | null = null;

		try {
			await placeHost(java, host, decor, position, size);

			if (stale()) return;

			surface = await fabric.mountAsync(host, surfaceName, {
				arrowDirection: below ? 'UP' : 'DOWN',
				arrowOffset,
				label: anchor.tooltip,
				width: frame.width,
			});
			await placeHost(java, host, decor, position, size);

			if (stale()) return;

			shown = { key: anchor.key, host, surface };
			surface = null;
			setTimeout(() => closeOnNextTouch(current), 0);
			timer = setTimeout(() => {
				if (current === generation) track(dismiss());
			}, Tooltip.duration);
		} finally {
			if (surface) await fabric.unmountAsync(surface).catch(() => undefined);

			if (shown?.host !== host) await removeHost(java, host).catch(() => undefined);
		}
	}

	return {
		show: (anchor) => track(show(anchor)),
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

export default { createAndroidTooltips };
