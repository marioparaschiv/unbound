import type { NativeHookToken, NativeObjectHandle, PluginContext } from '@unbound-app/api/native';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/safe-invoke';
import { viewKey } from '@unbound-plugins/shared/native/view-key';
import {
	parseNativeColorDescription,
	type RoleColorAppearance,
} from '@unbound-plugins/shared/colors/role-colors';

import { createGradientPainter, type TagLayer } from '~/native/gradient-layer';
import type { LabelAppearances } from '~/label-appearances';
import { createNativeColors } from '~/native/colors';

type PendingUpdate = { label: NativeObjectHandle; timer: ReturnType<typeof setTimeout> };
type QueuedView = { view: NativeObjectHandle; depth: number };

export type TagGradients = {
	/** Installs the hooks and returns the function that removes them and starts the teardown. */
	start(): () => void;
	/** Resolves once every gradient layer is removed after `start`'s cleanup ran. */
	settled(): Promise<void>;
};

/**
 * @description Draws role-color gradients behind Discord's native message tags on iOS.
 * @param context The plugin context, whose Objective-C bridge draws the gradients.
 * @param appearances The colors the tag patch chose for each tag text.
 * @returns The gradients feature; on Android, or when a class or capability is missing, `start` applies nothing.
 */
export function createTagGradients(
	context: PluginContext,
	appearances: LabelAppearances,
): TagGradients {
	let teardown = Promise.resolve();

	function start(): () => void {
		if (context.platform === 'android') return () => {};

		if (
			!ensureCapabilities('More User Tags: gradients', context.native, context.capabilities)
		) {
			return () => {};
		}

		const { objc } = context.native;
		const UIColor = objc.getClass('UIColor');
		const NSArray = objc.getClass('NSArray');
		const CAGradientLayer = objc.getClass('CAGradientLayer');

		if (
			!objc.getClass('DiscordChat.MessageTagView') ||
			!objc.getClass('DCDLabel') ||
			!CAGradientLayer ||
			!NSArray ||
			!UIColor
		) {
			console.error('[More User Tags: gradients] Skipped, native classes not found.');

			return () => {};
		}

		const colors = createNativeColors(objc, UIColor, NSArray);
		const painter = createGradientPainter(
			objc,
			{
				CAGradientLayer,
				CABasicAnimation: objc.getClass('CABasicAnimation'),
				CAMediaTimingFunction: objc.getClass('CAMediaTimingFunction'),
			},
			colors,
		);

		const associationKey = objc.createAssociationKey();
		const records = new Map<string, TagLayer>();
		const updating = new Set<string>();
		const inFlight = new Set<Promise<void>>();
		const pending = new Map<string, PendingUpdate>();
		const hooks: NativeHookToken[] = [];
		let stopped = false;

		function track(operation: Promise<void>): Promise<void> {
			inFlight.add(operation);
			void operation.finally(() => inFlight.delete(operation)).catch(() => {});

			return operation;
		}

		function release(view: NativeObjectHandle) {
			try {
				objc.call(view, 'release');
			} catch {
				// The view is already gone.
			}
		}

		async function subviews(view: NativeObjectHandle): Promise<NativeObjectHandle[]> {
			const children = await objc.invokeAsync(view, 'subviews', []);

			if (Array.isArray(children)) return children as NativeObjectHandle[];

			if (!children || typeof children !== 'object') return [];

			try {
				return objc
					.array(children as NativeObjectHandle)
					.filter(
						(child): child is NativeObjectHandle =>
							typeof child === 'object' && child !== null,
					);
			} catch {
				return [];
			}
		}

		async function removeRecord(record: TagLayer) {
			const wasUpdating = updating.has(record.id);

			updating.add(record.id);

			try {
				await safeInvokeAsync(objc, record.layer, 'removeFromSuperlayer');

				const background = (await safeInvokeAsync(
					objc,
					record.label,
					'backgroundColor',
				)) as NativeObjectHandle | null;

				if (await colors.isTransparent(background)) {
					await safeInvokeAsync(
						objc,
						record.label,
						'setBackgroundColor:',
						record.originalBackground,
					);
				}

				if (!(await objc.invokeAsync(record.label, 'isOpaque', []))) {
					await safeInvokeAsync(objc, record.label, 'setOpaque:', record.originalOpaque);
				}
			} finally {
				try {
					objc.setAssociatedObject(record.label, associationKey, null, 'assign');
				} catch {
					// The label is already gone, and its association with it.
				}

				records.delete(record.id);

				if (!wasUpdating) updating.delete(record.id);
			}
		}

		async function createRecord(
			label: NativeObjectHandle,
			labelName: string,
			primaryColor: string,
			appearance: RoleColorAppearance,
		) {
			let layer: NativeObjectHandle | null = null;
			let originalBackground: NativeObjectHandle | null = null;
			let associated = false;
			const id = viewKey(objc, label);

			if (!id || !(await colors.clear)) return;

			try {
				const parent = (await objc.invokeAsync(
					label,
					'superview',
					[],
				)) as NativeObjectHandle | null;

				if (!parent) return;

				const parentLayer = (await objc.invokeAsync(
					parent,
					'layer',
					[],
				)) as NativeObjectHandle | null;

				if (!parentLayer) return;

				layer = await painter.createLayer();

				if (!layer) return;

				originalBackground = (await objc.invokeAsync(
					label,
					'backgroundColor',
					[],
				)) as NativeObjectHandle | null;

				const originalOpaque = Boolean(await objc.invokeAsync(label, 'isOpaque', []));
				const labelLayer = await objc.invokeAsync(label, 'layer', []);

				if (stopped) return;

				const record: TagLayer = {
					id,
					label,
					layer,
					labelName,
					primaryColor,
					colors: [],
					style: 'solid',
					originalBackground,
					originalOpaque,
					geometry: { frameSignature: '', cornerRadius: null },
					sheen: null,
				};

				await objc.invokeAsync(parentLayer, 'insertSublayer:below:', [layer, labelLayer]);
				objc.setAssociatedObject(label, associationKey, layer, 'retain');
				associated = true;
				await objc.invokeAsync(label, 'setBackgroundColor:', [await colors.clear]);
				await objc.invokeAsync(label, 'setOpaque:', [false]);
				records.set(id, record);

				if (!(await painter.paint(record, appearance))) await removeRecord(record);
			} catch {
				if (layer) await safeInvokeAsync(objc, layer, 'removeFromSuperlayer');

				if (associated) objc.setAssociatedObject(label, associationKey, null, 'assign');

				await safeInvokeAsync(objc, label, 'setBackgroundColor:', originalBackground);
			}
		}

		async function readLabel(label: NativeObjectHandle, record: TagLayer | undefined) {
			const text = await objc.invokeAsync(label, 'text', []);
			const accessibilityLabel = await objc.invokeAsync(label, 'accessibilityLabel', []);
			const labelName =
				typeof text === 'string' && text.length > 0
					? text
					: typeof accessibilityLabel === 'string'
						? accessibilityLabel
						: '';

			if (!labelName) return null;

			const background = (await objc.invokeAsync(
				label,
				'backgroundColor',
				[],
			)) as NativeObjectHandle | null;
			const description = background
				? await objc.invokeAsync(background, 'description', [])
				: null;
			const color =
				typeof description === 'string' ? parseNativeColorDescription(description) : null;
			// Once the gradient is drawn the label is clear, so fall back to the color it was drawn for.
			const primaryColor =
				color && color.alpha > 0 ? color.hex : (record?.primaryColor ?? null);
			const match = appearances.find(labelName, primaryColor);

			return match ? { labelName, ...match } : null;
		}

		async function updateLabel(label: NativeObjectHandle) {
			if (stopped || appearances.isEmpty() || objc.className(label) !== 'DCDLabel') return;

			const id = viewKey(objc, label);

			if (!id || updating.has(id)) return;

			updating.add(id);

			try {
				let record = records.get(id);
				const match = await readLabel(label, record);

				if (stopped) return;

				if (!match) {
					if (record) await removeRecord(record);

					return;
				}

				if (
					record &&
					(record.labelName !== match.labelName ||
						record.primaryColor !== match.primaryColor)
				) {
					await removeRecord(record);
					record = undefined;
				}

				if (!record) {
					await createRecord(
						label,
						match.labelName,
						match.primaryColor,
						match.appearance,
					);

					return;
				}

				if (!(await painter.paint(record, match.appearance))) await removeRecord(record);
			} catch {
				// The label's next layout pass retries.
			} finally {
				updating.delete(id);
			}
		}

		async function runPendingUpdate(id: string, label: NativeObjectHandle) {
			pending.delete(id);

			try {
				await track(updateLabel(label));
			} finally {
				release(label);
			}
		}

		// Native hooks fire many times per layout; batch them into one update per label per tick.
		async function scheduleLabelUpdate(label: NativeObjectHandle) {
			if (stopped || appearances.isEmpty() || objc.className(label) !== 'DCDLabel') return;

			let retained: NativeObjectHandle;

			// Keep the label alive until the deferred update has run.
			try {
				retained = objc.call(label, 'retain') as NativeObjectHandle;
			} catch {
				return;
			}

			const id = viewKey(objc, retained);

			if (!id || stopped || pending.has(id)) {
				release(retained);

				return;
			}

			const timer = setTimeout(() => void runPendingUpdate(id, retained), 0);

			pending.set(id, { label: retained, timer });
		}

		async function updateTagView(view: NativeObjectHandle) {
			if (stopped || appearances.isEmpty()) return;

			const retained = objc.call(view, 'retain') as NativeObjectHandle;

			try {
				for (const label of await subviews(retained)) await scheduleLabelUpdate(label);
			} catch {
				// The view's next layout pass retries.
			} finally {
				objc.call(retained, 'release');
			}
		}

		// A recycled message cell keeps its labels, so drop their gradients before the cell shows another message.
		async function clearReusedCell(cell: NativeObjectHandle) {
			const retained = objc.call(cell, 'retain') as NativeObjectHandle;
			const queue: QueuedView[] = [{ view: retained, depth: 0 }];

			try {
				for (let current = queue.pop(); current && !stopped; current = queue.pop()) {
					if (objc.className(current.view) === 'DCDLabel') {
						const record = records.get(viewKey(objc, current.view) ?? '');

						if (record) await removeRecord(record);

						continue;
					}

					if (current.depth >= 8) {
						continue;
					}

					const children = await subviews(current.view);

					for (const child of children.slice(0, 20)) {
						queue.push({ view: child, depth: current.depth + 1 });
					}
				}
			} catch {
				// A label left behind is cleared on its next update.
			} finally {
				objc.call(retained, 'release');
			}
		}

		function hook(
			className: string,
			selector: string,
			handler: (view: NativeObjectHandle) => Promise<void>,
		): boolean {
			try {
				hooks.push(
					objc.hook(className, selector, { after: ({ self }) => track(handler(self)) }),
				);

				return true;
			} catch {
				return false;
			}
		}

		const installed = [
			hook('DCDLabel', 'setBackgroundColor:', scheduleLabelUpdate),
			hook('DCDLabel', 'setText:', scheduleLabelUpdate),
			hook('DiscordChat.MessageTagView', 'layoutSubviews', updateTagView),
		];

		if (!installed.includes(true)) {
			console.error('[More User Tags: gradients] Skipped, native hooks unavailable.');

			return () => {};
		}

		if (objc.getClass('DCDMessageTableViewCell')) {
			hook('DCDMessageTableViewCell', 'prepareForReuse', clearReusedCell);
		}

		async function removeAll() {
			await Promise.allSettled([...inFlight]);

			for (const record of [...records.values()]) {
				await removeRecord(record).catch(() => undefined);
			}

			appearances.clear();
		}

		return () => {
			stopped = true;

			for (const { label, timer } of pending.values()) {
				clearTimeout(timer);
				release(label);
			}

			pending.clear();

			for (const token of hooks) token.remove();

			teardown = removeAll();
		};
	}

	return { start, settled: () => teardown };
}

export default { createTagGradients };
