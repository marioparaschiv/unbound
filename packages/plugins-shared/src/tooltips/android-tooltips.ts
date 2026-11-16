import type {
	NativeFabricBridge,
	NativeFabricFrame as Frame,
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
import { insetFrame, systemBarInsets } from '@unbound-plugins/shared/native/android/window-insets';
import { currentDecorView } from '@unbound-plugins/shared/native/android/views';
import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import {
	placeTooltip,
	tooltipTextWidth,
	TooltipStyle,
} from '@unbound-plugins/shared/tooltips/tooltip-layout';
import TooltipBubble from '@unbound-plugins/shared/tooltips/tooltip-bubble';

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	fabric: NativeFabricBridge;
};

export type AndroidTooltipAnchor = {
	/** Names what the tooltip belongs to, so `dismissFor` can close it. */
	key: string;
	text: string;
	/** Finds the anchor's frame in the window, in dp, given the display density. */
	frame(density: number): Promise<Frame | null> | Frame | null;
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

const REACT_TEXT_WIDTH_RATIO = 1.05;

type Metrics = {
	density: number;
};

/**
 * @description Creates tooltips in Discord's colors on their own surface over the window, closed by the next touch or after a few seconds, like the iOS ones.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param surfaceKey The plugin's own name for the tooltip's app surface.
 * @returns The tooltip controller.
 */
export function createAndroidTooltips(
	{ java, hooks, fabric }: Native,
	surfaceKey: string,
): AndroidTooltips {
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

	async function metricsOf(view: NativeJavaReference): Promise<Metrics> {
		const resources = javaReference(await java.invokeAsync(view, 'getResources', []));
		const metrics = resources
			? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
			: null;

		return { density: metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1 };
	}

	function measure(text: string, maxWidth: number, metrics: Metrics) {
		const paint = java.construct('android.text.TextPaint', []);

		java.invoke(paint, 'setTextSize', [javaFloat(TooltipStyle.fontSize * metrics.density)]);
		const typeface = javaReference(
			java.invoke(java.getClass('android.graphics.Typeface'), 'create', [
				javaString('sans-serif'),
				javaInt(0),
			]),
		);

		if (typeface) java.invoke(paint, 'setTypeface', [typeface]);

		const builder = javaReference(
			java.invoke(java.getClass('android.text.StaticLayout$Builder'), 'obtain', [
				javaString(text),
				javaInt(0),
				javaInt(text.length),
				paint,
				javaInt(Math.round(maxWidth * metrics.density)),
			]),
		);
		const layout = builder ? javaReference(java.invoke(builder, 'build', [])) : null;

		if (!layout) return null;

		const lines = javaNumber(java.invoke(layout, 'getLineCount', [])) ?? 0;
		let width = 0;

		for (let line = 0; line < lines; line++) {
			width = Math.max(
				width,
				javaNumber(java.invoke(layout, 'getLineWidth', [javaInt(line)])) ?? 0,
			);
		}

		return {
			width: (Math.ceil(width) / metrics.density) * REACT_TEXT_WIDTH_RATIO,
			height: (javaNumber(java.invoke(layout, 'getHeight', [])) ?? 0) / metrics.density,
		};
	}

	async function show(anchor: AndroidTooltipAnchor) {
		await dismiss();

		const current = generation;
		const stale = () => disposed || current !== generation;
		const decor = currentDecorView(java);

		if (stale() || !decor) return;

		surfaceName ??= registerAppSurface(surfaceKey, TooltipBubble);

		if (!surfaceName) return;

		const metrics = await metricsOf(decor);
		const insets = await systemBarInsets(java, decor);
		const bounds = insetFrame(
			{
				x: 0,
				y: 0,
				width: javaNumber(await java.invokeAsync(decor, 'getWidth', [])) ?? 0,
				height: javaNumber(await java.invokeAsync(decor, 'getHeight', [])) ?? 0,
			},
			insets,
		);

		bounds.x /= metrics.density;
		bounds.y /= metrics.density;
		bounds.width /= metrics.density;
		bounds.height /= metrics.density;
		const text = measure(anchor.text, tooltipTextWidth(bounds.width), metrics);
		const anchorFrame = text ? await anchor.frame(metrics.density) : null;
		const placement = text && anchorFrame ? placeTooltip(text, anchorFrame, bounds) : null;

		if (!placement) return;

		const { frame, below, arrowOffset } = placement;
		const position = { x: frame.x * metrics.density, y: frame.y * metrics.density };
		const size = {
			width: frame.width * metrics.density,
			height: frame.height * metrics.density,
		};
		const host = await createHost(java, decor);
		let surface: NativeFabricSurface | null = null;

		try {
			await placeHost(java, host, decor, position, size);

			if (stale()) return;

			surface = await fabric.mountAsync(host, surfaceName, {
				arrowDirection: below ? 'UP' : 'DOWN',
				arrowOffset,
				label: anchor.text,
				width: frame.width,
			});
			await placeHost(java, host, decor, position, size);

			if (stale()) return;

			shown = { key: anchor.key, host, surface };
			surface = null;
			setTimeout(() => closeOnNextTouch(current), 0);
			timer = setTimeout(() => {
				if (current === generation) track(dismiss());
			}, TooltipStyle.duration);
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
