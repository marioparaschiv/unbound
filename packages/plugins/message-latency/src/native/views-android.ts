import { createSurfaceListeners } from '@unbound-plugins/shared/native/surface-listeners';
import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type {
	NativeFabricBridge,
	NativeFabricSurface,
	NativeJavaBridge,
	NativeJavaHandle,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIBridge,
} from '@unbound-app/api/native';
import {
	createHost,
	hostContainer,
	layoutHostingList,
	placeHost,
	removeHost,
} from '@unbound-plugins/shared/native/android/inline-hosts';
import {
	javaInt,
	javaNumber,
	javaReference,
	javaViewKey,
	sameJavaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import { viewByIdNameAsync } from '@unbound-plugins/shared/native/android/discord-views';
import { watchMessageRows } from '@unbound-plugins/shared/native/android/message-rows';
import { displayDensity, readCalls, runOnMain } from '@unbound-plugins/shared/native/android/views';

import { registerLatencyIconSurface } from '~/components/latency-icon';
import type { LatencyRecord, LatencyRecords } from '~/lib/records';
import type { AndroidTooltips } from '~/native/tooltip-android';
import { subscribeTheme } from '~/lib/theme';
import { Icon } from '~/constants';

const DRAWABLE = 'android.graphics.drawable.Drawable';
const NO_DRAWABLE = { type: 'null', class: DRAWABLE } as const;
const VISIBLE = 0;
const SETTLE_DELAYS = [0, 120, 600];

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	fabric: NativeFabricBridge;
	ui: NativeUIBridge;
};

type Indicator = {
	id: string;
	messageView: NativeJavaReference;
	authorName: NativeJavaReference;
	host: NativeJavaHandle;
	spacer: NativeJavaHandle;
	mounting: Promise<NativeFabricSurface> | null;
	messageId: string;
	record: LatencyRecord;
	revision: number;
	disposed: boolean;
	placed: boolean;
};

/**
 * @description Draws the latency indicator in front of the author name of Discord's Android message rows, like the iOS one, and opens its tooltip on tap.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param records The latency cache to draw from.
 * @param tooltips The tooltip shown when an indicator is tapped, or `null` when unavailable. The indicators own and dispose it.
 * @returns `dispose`, which removes every indicator and resolves once the rows are restored, or `undefined` when the icon surface did not register.
 */
export function createAndroidIndicators(
	native: Native,
	records: LatencyRecords,
	tooltips: AndroidTooltips | null,
) {
	const { java, fabric } = native;
	const indicators = new Map<string, Indicator>();
	const byId = new Map<string, Indicator>();
	const listeners = createSurfaceListeners();
	let nextId = 0;
	let disposed = false;

	const iconModule = registerLatencyIconSurface({
		record: (surfaceId) => byId.get(surfaceId)?.record,
		revision: (surfaceId) => byId.get(surfaceId)?.revision ?? -1,
		subscribe: listeners.subscribe,
		press(surfaceId) {
			const indicator = byId.get(surfaceId);

			if (indicator && !indicator.disposed) {
				tooltips?.show({
					key: indicator.id,
					host: indicator.host,
					tooltip: indicator.record.tooltip,
				});
			}
		},
	});

	if (!iconModule) return undefined;

	function publish(indicator: Indicator) {
		indicator.revision++;
		listeners.notify(indicator.id);
	}

	async function startDrawable(
		authorName: NativeJavaReference,
	): Promise<NativeJavaReference | null> {
		const drawables = await java.invokeAsync(authorName, 'getCompoundDrawablesRelative', []);

		return javaReference(
			java.invoke(java.getClass('java.lang.reflect.Array'), 'get', [drawables, javaInt(0)]),
		);
	}

	async function createSpacer(authorName: NativeJavaReference): Promise<NativeJavaHandle> {
		const scale = await displayDensity(java, authorName);
		const spacer = java.construct('android.graphics.drawable.ColorDrawable', [javaInt(0)]);

		java.invoke(spacer, 'setBounds', [
			javaInt(0),
			javaInt(0),
			javaInt(Math.round(Icon.controlWidth * scale)),
			javaInt(Math.round(Icon.controlHeight * scale)),
		]);

		return spacer;
	}

	async function relayout(indicator: Indicator) {
		await java.invokeAsync(indicator.authorName, 'requestLayout', []);
		await layoutHostingList(java, indicator.messageView);
	}

	function mark(indicator: Indicator) {
		rows.markDrawn(indicator.messageView, indicator.messageId, [indicator.host]);
	}

	async function remove(indicator: Indicator) {
		indicator.disposed = true;
		rows.markDrawn(indicator.messageView, indicator.messageId, []);
		byId.delete(indicator.id);
		indicators.delete(javaViewKey(indicator.messageView as NativeJavaValue) ?? '');
		tooltips?.dismissFor(indicator.id);

		const mounted = await indicator.mounting?.catch(() => null);

		if (mounted) await fabric.unmountAsync(mounted).catch(() => undefined);

		await removeHost(java, indicator.host).catch(() => undefined);

		if (sameJavaReference(await startDrawable(indicator.authorName), indicator.spacer)) {
			await java.invokeAsync(indicator.authorName, 'setCompoundDrawablesRelative', [
				NO_DRAWABLE,
				NO_DRAWABLE,
				NO_DRAWABLE,
				NO_DRAWABLE,
			]);
			await relayout(indicator);
		}
	}

	async function place(indicator: Indicator) {
		if (indicator.disposed) return;

		const scale = await displayDensity(java, indicator.authorName);
		const container = await hostContainer(java, indicator.authorName);

		if (!container) return;

		const width = Icon.controlWidth * scale;
		const height = Icon.controlHeight * scale;
		const [nameHeight, paddingStart] = (
			await runOnMain(java, readCalls(indicator.authorName, ['getHeight', 'getPaddingStart']))
		).map((value) => javaNumber(value) ?? 0) as [number, number];

		await placeHost(
			java,
			indicator.host,
			container.container,
			{
				x: container.offset.x + paddingStart,
				y: container.offset.y + (nameHeight - height) / 2,
			},
			{ width, height },
		);
		await java.invokeAsync(indicator.host, 'setVisibility', [javaInt(VISIBLE)]);
		indicator.placed = true;

		if (!indicator.mounting && !indicator.disposed) {
			indicator.mounting = fabric.mountAsync(indicator.host, iconModule!, {
				surfaceId: indicator.id,
			});
			await indicator.mounting.catch((error: unknown) => {
				indicator.mounting = null;
				throw error;
			});
			await placeHost(
				java,
				indicator.host,
				container.container,
				{
					x: container.offset.x + paddingStart,
					y: container.offset.y + (nameHeight - height) / 2,
				},
				{ width, height },
			);
		}
	}

	function settle(indicator: Indicator) {
		for (const delay of SETTLE_DELAYS) {
			setTimeout(() => {
				place(indicator).catch((error) => {
					if (!isCancellation(error)) {
						logger.error('Failed to place an Android indicator:', error);
					}
				});
			}, delay);
		}
	}

	async function isVisible(view: NativeJavaReference): Promise<boolean> {
		return javaNumber(await java.invokeAsync(view, 'getVisibility', [])) === VISIBLE;
	}

	async function render(messageView: NativeJavaReference, messageId: string) {
		const key = javaViewKey(messageView as NativeJavaValue);

		if (!key || disposed) return;

		const record = records.get(messageId);
		const existing = indicators.get(key);
		const header = await viewByIdNameAsync(java, messageView, 'header');
		const authorName = await viewByIdNameAsync(java, messageView, 'author_name');
		const shown =
			header && authorName && (await isVisible(header)) && (await isVisible(authorName));

		if (!record || !shown) {
			if (existing) await remove(existing);

			return;
		}

		const current = await startDrawable(authorName);

		if (existing && !existing.disposed && sameJavaReference(existing.authorName, authorName)) {
			const sameMessage = existing.messageId === messageId;

			existing.messageId = messageId;
			existing.record = record;
			mark(existing);
			publish(existing);

			if (!sameJavaReference(current, existing.spacer)) {
				await java.invokeAsync(authorName, 'setCompoundDrawablesRelative', [
					existing.spacer,
					NO_DRAWABLE,
					NO_DRAWABLE,
					NO_DRAWABLE,
				]);
				await relayout(existing);
				settle(existing);

				return;
			}

			if (!sameMessage || !existing.placed) settle(existing);

			return;
		}

		if (existing) await remove(existing);

		if (current) return;

		const indicator: Indicator = {
			id: `message-latency-android-${nextId++}`,
			messageView,
			authorName,
			host: await createHost(java, authorName),
			spacer: await createSpacer(authorName),
			mounting: null,
			messageId,
			record,
			revision: 0,
			disposed: false,
			placed: false,
		};

		indicators.set(key, indicator);
		byId.set(indicator.id, indicator);
		mark(indicator);
		await java.invokeAsync(authorName, 'setCompoundDrawablesRelative', [
			indicator.spacer,
			NO_DRAWABLE,
			NO_DRAWABLE,
			NO_DRAWABLE,
		]);
		await relayout(indicator);
		settle(indicator);
	}

	async function clear(messageView: NativeJavaReference) {
		const indicator = indicators.get(javaViewKey(messageView as NativeJavaValue) ?? '');

		if (indicator) await remove(indicator);
	}

	const rows = watchMessageRows(native, { draw: render, clear });

	const unsubscribeRecords = records.subscribe((messageId) => rows.redraw(messageId));

	const unsubscribeTheme = subscribeTheme(() => {
		for (const indicator of indicators.values()) publish(indicator);
	});

	return {
		async dispose() {
			disposed = true;
			unsubscribeRecords();
			unsubscribeTheme();
			await rows.dispose();
			await Promise.all([...indicators.values()].map(remove));
			await tooltips?.dispose();
			listeners.clear();
		},
	};
}

export default { createAndroidIndicators };
