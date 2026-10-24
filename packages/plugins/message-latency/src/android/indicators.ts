import type {
	NativeFabricBridge,
	NativeFabricSurface,
	NativeJavaBridge,
	NativeJavaHandle,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
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
	javaText,
	sameJavaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import {
	currentDecorView,
	findViewsOfClass,
	STARTUP_SCAN_DELAYS,
} from '@unbound-plugins/shared/native/android/views';

import { registerLatencyIconSurface } from '~/components/latency-icon';
import type { LatencyRecord, LatencyRecords } from '~/records';
import type { AndroidTooltips } from '~/android/tooltip';
import { subscribeTheme } from '~/theme';
import { Icon } from '~/constants';

const MESSAGE_VIEW = 'com.discord.chat.presentation.message.MessageView';
const SET_MESSAGE_PARAMETERS = [
	'com.discord.chat.bridge.Message',
	'com.discord.chat.presentation.root.MessageContext',
	'com.discord.chat.presentation.events.ChatEventHandler',
	'com.discord.chat.presentation.message.view.botuikit.ComponentProvider',
	'kotlin.jvm.functions.Function0',
	'boolean',
	'boolean',
];
const DRAWABLE = 'android.graphics.drawable.Drawable';
const NO_DRAWABLE = { type: 'null', class: DRAWABLE } as const;
const VISIBLE = 0;
const SETTLE_DELAYS = [0, 120, 600];

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	fabric: NativeFabricBridge;
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
};

function viewKey(view: NativeJavaValue): string | undefined {
	return view.type === 'handle' ? view.value : undefined;
}

/**
 * @description Draws the latency indicator in front of the author name of Discord's Android message rows, like the iOS one, and opens its tooltip on tap.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param records The latency cache to draw from.
 * @param tooltips The tooltip shown when an indicator is tapped, or `null` when unavailable. The indicators own and dispose it.
 * @returns `dispose`, which removes every indicator and resolves once the rows are restored, or `undefined` when the icon surface did not register.
 */
export function createAndroidIndicators(
	{ java, hooks, fabric }: Native,
	records: LatencyRecords,
	tooltips: AndroidTooltips | null,
) {
	const indicators = new Map<string, Indicator>();
	const byId = new Map<string, Indicator>();
	const bound = new Map<string, { messageView: NativeJavaReference; messageId: string }>();
	const listeners = new Map<string, Set<() => void>>();
	const queues = new Map<string, Promise<void>>();
	let nextId = 0;
	let disposed = false;

	const iconModule = registerLatencyIconSurface({
		record: (surfaceId) => byId.get(surfaceId)?.record,
		revision: (surfaceId) => byId.get(surfaceId)?.revision ?? -1,
		subscribe(surfaceId, listener) {
			const set = listeners.get(surfaceId) ?? new Set();

			set.add(listener);
			listeners.set(surfaceId, set);

			return () => {
				set.delete(listener);

				if (!set.size) listeners.delete(surfaceId);
			};
		},
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

		for (const listener of listeners.get(indicator.id) ?? []) listener();
	}

	function bindingView(messageView: NativeJavaReference, field: string) {
		const binding = javaReference(java.getField(messageView, 'binding'));

		return binding ? javaReference(java.getField(binding, field)) : null;
	}

	function density(view: NativeJavaReference): number {
		const resources = javaReference(java.invoke(view, 'getResources', []));
		const metrics = resources
			? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
			: null;

		return metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;
	}

	function startDrawable(authorName: NativeJavaReference): NativeJavaReference | null {
		const drawables = java.invoke(authorName, 'getCompoundDrawablesRelative', []);

		return javaReference(
			java.invoke(java.getClass('java.lang.reflect.Array'), 'get', [drawables, javaInt(0)]),
		);
	}

	function createSpacer(authorName: NativeJavaReference): NativeJavaHandle {
		const scale = density(authorName);
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

	async function remove(indicator: Indicator) {
		indicator.disposed = true;
		byId.delete(indicator.id);
		indicators.delete(viewKey(indicator.messageView as NativeJavaValue) ?? '');
		tooltips?.dismissFor(indicator.id);

		const mounted = await indicator.mounting?.catch(() => null);

		if (mounted) await fabric.unmountAsync(mounted).catch(() => undefined);

		await removeHost(java, indicator.host).catch(() => undefined);

		if (sameJavaReference(startDrawable(indicator.authorName), indicator.spacer)) {
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

		const scale = density(indicator.authorName);
		const container = hostContainer(java, indicator.authorName);

		if (!container) return;

		const width = Icon.controlWidth * scale;
		const height = Icon.controlHeight * scale;
		const nameHeight = javaNumber(java.invoke(indicator.authorName, 'getHeight', [])) ?? 0;
		const paddingStart =
			javaNumber(java.invoke(indicator.authorName, 'getPaddingStart', [])) ?? 0;

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
					console.error('[Message Latency] Failed to place an Android indicator:', error);
				});
			}, delay);
		}
	}

	async function render(messageView: NativeJavaReference, messageId: string) {
		const key = viewKey(messageView as NativeJavaValue);

		if (!key || disposed) return;

		const record = records.get(messageId);
		const existing = indicators.get(key);
		const header = bindingView(messageView, 'header');
		const authorName = bindingView(messageView, 'authorName');
		const shown =
			header &&
			authorName &&
			javaNumber(java.invoke(header, 'getVisibility', [])) === VISIBLE;

		if (!record || !shown) {
			if (existing) await remove(existing);

			return;
		}

		const current = startDrawable(authorName);

		if (existing && !existing.disposed && sameJavaReference(existing.authorName, authorName)) {
			existing.messageId = messageId;
			existing.record = record;
			publish(existing);

			if (!sameJavaReference(current, existing.spacer)) {
				await java.invokeAsync(authorName, 'setCompoundDrawablesRelative', [
					existing.spacer,
					NO_DRAWABLE,
					NO_DRAWABLE,
					NO_DRAWABLE,
				]);
				await relayout(existing);
			}

			settle(existing);

			return;
		}

		if (existing) await remove(existing);

		if (current) return;

		const indicator: Indicator = {
			id: `message-latency-android-${nextId++}`,
			messageView,
			authorName,
			host: createHost(java, authorName),
			spacer: createSpacer(authorName),
			mounting: null,
			messageId,
			record,
			revision: 0,
			disposed: false,
		};

		indicators.set(key, indicator);
		byId.set(indicator.id, indicator);
		await java.invokeAsync(authorName, 'setCompoundDrawablesRelative', [
			indicator.spacer,
			NO_DRAWABLE,
			NO_DRAWABLE,
			NO_DRAWABLE,
		]);
		await relayout(indicator);
		settle(indicator);
	}

	function schedule(messageView: NativeJavaReference, messageId: string) {
		const key = viewKey(messageView as NativeJavaValue);

		if (!key || disposed) return;

		bound.set(key, { messageView, messageId });

		const next = (queues.get(key) ?? Promise.resolve())
			.then(() =>
				bound.get(key)?.messageId === messageId
					? render(messageView, messageId)
					: undefined,
			)
			.catch((error) => {
				console.error('[Message Latency] Failed to draw an Android indicator:', error);
			})
			.finally(() => {
				if (queues.get(key) === next) queues.delete(key);
			});

		queues.set(key, next);
	}

	const token = hooks.hook(
		MESSAGE_VIEW,
		'setMessage',
		SET_MESSAGE_PARAMETERS,
		{ notify: true },
		({ self, args }) => {
			const messageView = javaReference(self);
			const message = javaReference(args[0]);
			const messageId = message
				? javaText(java.invoke(message, 'getId-3Eiw7ao', []))
				: undefined;

			if (messageView && messageId) setTimeout(() => schedule(messageView, messageId), 0);
		},
	);

	const unsubscribeRecords = records.subscribe((messageId) => {
		for (const { messageView, messageId: boundId } of bound.values()) {
			if (boundId === messageId) schedule(messageView, messageId);
		}
	});

	const unsubscribeTheme = subscribeTheme(() => {
		for (const indicator of indicators.values()) publish(indicator);
	});

	function scanVisible() {
		const decor = currentDecorView(java);

		if (!decor || disposed) return;

		for (const messageView of findViewsOfClass(java, decor, MESSAGE_VIEW)) {
			const messageId = javaText(java.getField(messageView, 'messageId'));

			if (messageId) schedule(messageView, messageId);
		}
	}

	const scans = STARTUP_SCAN_DELAYS.map((delay) => setTimeout(scanVisible, delay));

	return {
		async dispose() {
			for (const scan of scans) clearTimeout(scan);

			disposed = true;
			hooks.remove(token);
			unsubscribeRecords();
			unsubscribeTheme();
			await Promise.all([...queues.values()]);
			await Promise.all([...indicators.values()].map(remove));
			await tooltips?.dispose();
			bound.clear();
			listeners.clear();
		},
	};
}

export default { createAndroidIndicators };
