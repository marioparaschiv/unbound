import {
	getRoleGradientKey,
	parseNativeColorDescription,
	type RoleColorAppearance,
	type RoleColorStyle,
} from '@shared/role-colors';
import type {
	NativeAssociationKey,
	NativeClassHandle,
	NativeObjectHandle,
	PluginContext,
} from '@unbound-app/api/native';

type NativeObjC = PluginContext['native']['objc'];

interface TagGradientRecord {
	id: string;
	label: NativeObjectHandle;
	layer: NativeObjectHandle;
	frameSignature: string;
	cornerRadius: number | null;
	sheenFrameSignature: string;
	sheenCornerRadius: number | null;
	originalBackground: NativeObjectHandle | null;
	originalOpaque: boolean;
	labelName: string;
	primaryColor: string;
	colors: string[];
	style: RoleColorStyle;
	sheenLayer: NativeObjectHandle | null;
}

interface TagGradientRenderer {
	setAppearance(labels: string[], appearance: RoleColorAppearance): void;
	stop(): Promise<void>;
}

interface NativeRectFields {
	origin: { x: number; y: number };
	size: { width: number; height: number };
}

function rectSignature(rect: unknown): string | null {
	const value = (rect as { value?: NativeRectFields } | null)?.value;
	if (!value) return null;
	const coordinates = [value.origin.x, value.origin.y, value.size.width, value.size.height];
	return coordinates.every(Number.isFinite) ? coordinates.join(':') : null;
}

async function invoke(
	objc: NativeObjC,
	target: NativeObjectHandle,
	selector: string,
	args: unknown[] = [],
): Promise<unknown> {
	return objc.invokeAsync(target, selector, args);
}

async function gradientColorObject(
	objc: NativeObjC,
	arrayClass: NativeClassHandle,
	uiColorClass: NativeObjectHandle,
	color: string,
	alpha: number = 1,
): Promise<NativeObjectHandle | null> {
	if (!/^#[\da-f]{6}$/i.test(color)) return null;
	const value = Number.parseInt(color.slice(1), 16);
	const red = ((value >> 16) & 0xff) / 255;
	const green = ((value >> 8) & 0xff) / 255;
	const blue = (value & 0xff) / 255;

	try {
		const uiColor = (await invoke(objc, uiColorClass, 'colorWithRed:green:blue:alpha:', [
			red,
			green,
			blue,
			alpha,
		])) as NativeObjectHandle | null;
		if (!uiColor) return null;
		const pointer = await invoke(objc, uiColor, 'CGColor');
		if (!pointer) return null;
		const colors = await invoke(objc, arrayClass, 'arrayWithObject:', [pointer]);
		if (!Array.isArray(colors)) return null;

		const [nativeColor] = colors;
		return nativeColor && typeof nativeColor === 'object'
			? (nativeColor as NativeObjectHandle)
			: null;
	} catch {
		return null;
	}
}

function keyForLabel(label: string, color: string): string {
	return getRoleGradientKey(label, color);
}

function appearanceForLabel(
	appearances: Map<string, RoleColorAppearance>,
	label: string,
	primaryColor: string | null,
): { primaryColor: string; appearance: RoleColorAppearance } | null {
	if (primaryColor) {
		const appearance = appearances.get(keyForLabel(label, primaryColor));
		if (appearance) return { primaryColor, appearance };
	}

	const prefix = `${label.trim().toLowerCase()}:`;
	const unique = new Map<string, { primaryColor: string; appearance: RoleColorAppearance }>();

	for (const [key, appearance] of appearances) {
		if (!key.startsWith(prefix)) continue;
		unique.set(JSON.stringify(appearance), {
			primaryColor: key.slice(prefix.length),
			appearance,
		});
	}

	if (unique.size !== 1) return null;
	return unique.values().next().value ?? null;
}

async function viewIdentifier(objc: NativeObjC, view: NativeObjectHandle): Promise<string> {
	return String(await invoke(objc, view, 'hash'));
}

async function nativeChildren(
	objc: NativeObjC,
	view: NativeObjectHandle,
): Promise<NativeObjectHandle[]> {
	const children = await invoke(objc, view, 'subviews');
	if (Array.isArray(children)) return children as NativeObjectHandle[];
	if (!children || typeof children !== 'object') return [];

	try {
		return objc
			.array(children as NativeObjectHandle)
			.filter(
				(child): child is NativeObjectHandle => typeof child === 'object' && child !== null,
			);
	} catch {
		return [];
	}
}

async function attempt(operation: () => Promise<unknown>): Promise<boolean> {
	try {
		await operation();
		return true;
	} catch {
		return false;
	}
}

export function createTagGradientRenderer(context: PluginContext): TagGradientRenderer | null {
	const objc = context.native.objc;
	const tagViewClass = objc.getClass('DiscordChat.MessageTagView');
	const labelClass = objc.getClass('DCDLabel');
	const gradientLayerClass = objc.getClass('CAGradientLayer');
	const arrayClass = objc.getClass('NSArray');
	const basicAnimationClass = objc.getClass('CABasicAnimation');
	const timingFunctionClass = objc.getClass('CAMediaTimingFunction');
	const accessibilityClass = objc.getClass('UIAccessibility');
	const uiColorClass = objc.getClass('UIColor');

	if (!tagViewClass || !labelClass || !gradientLayerClass || !arrayClass || !uiColorClass) {
		return null;
	}
	const resolvedGradientLayerClass: NativeObjectHandle = gradientLayerClass;
	const resolvedArrayClass: NativeClassHandle = arrayClass;
	const resolvedBasicAnimationClass: NativeObjectHandle | null = basicAnimationClass;
	const resolvedTimingFunctionClass: NativeObjectHandle | null = timingFunctionClass;
	const resolvedAccessibilityClass: NativeObjectHandle | null = accessibilityClass;
	const resolvedUIColorClass: NativeObjectHandle = uiColorClass;
	const clearColor = invoke(objc, resolvedUIColorClass, 'clearColor').catch(
		() => null,
	) as Promise<NativeObjectHandle | null>;

	const associationKey: NativeAssociationKey = objc.createAssociationKey();
	const appearances = new Map<string, RoleColorAppearance>();
	const records = new Map<string, TagGradientRecord>();
	const updating = new Set<string>();
	const inFlight = new Set<Promise<void>>();
	const pendingUpdates = new Map<
		string,
		{ label: NativeObjectHandle; timer: ReturnType<typeof setTimeout> }
	>();
	const hookTokens: ReturnType<NativeObjC['hook']>[] = [];
	let stopped = false;
	function track(operation: Promise<void>): Promise<void> {
		inFlight.add(operation);
		void operation.finally(() => inFlight.delete(operation)).catch(() => {});
		return operation;
	}
	const reduceMotion = resolvedAccessibilityClass
		? invoke(objc, resolvedAccessibilityClass, 'isReduceMotionEnabled')
				.then(Boolean)
				.catch(() => false)
		: Promise.resolve(false);

	async function isTransparent(color: NativeObjectHandle | null): Promise<boolean> {
		if (!color) return false;
		if (await invoke(objc, color, 'isEqual:', [await clearColor])) return true;
		const description = await invoke(objc, color, 'description');
		return (
			typeof description === 'string' && parseNativeColorDescription(description)?.alpha === 0
		);
	}

	async function removeRecord(
		record: TagGradientRecord,
		restoreBackground: boolean,
	): Promise<void> {
		const wasUpdating = updating.has(record.id);
		updating.add(record.id);

		try {
			await attempt(() => invoke(objc, record.layer, 'removeFromSuperlayer'));

			if (restoreBackground) {
				const background = (await invoke(objc, record.label, 'backgroundColor').catch(
					() => null,
				)) as NativeObjectHandle | null;
				if (await isTransparent(background)) {
					await attempt(() =>
						invoke(objc, record.label, 'setBackgroundColor:', [
							record.originalBackground,
						]),
					);
				}

				if (!(await invoke(objc, record.label, 'isOpaque'))) {
					await attempt(() =>
						invoke(objc, record.label, 'setOpaque:', [record.originalOpaque]),
					);
				}
			}
		} finally {
			try {
				objc.setAssociatedObject(record.label, associationKey, null, 'assign');
			} catch {}
			records.delete(record.id);
			if (!wasUpdating) updating.delete(record.id);
		}
	}

	async function updateFrame(record: TagGradientRecord): Promise<void> {
		const labelLayer = (await invoke(objc, record.label, 'layer')) as NativeObjectHandle;
		const frame = await invoke(objc, record.label, 'frame');
		const signature = rectSignature(frame);
		const radius = Number(await invoke(objc, labelLayer, 'cornerRadius'));
		if (signature && signature !== record.frameSignature) {
			await invoke(objc, record.layer, 'setFrame:', [frame]);
			record.frameSignature = signature;
		}
		if (Number.isFinite(radius) && radius !== record.cornerRadius) {
			await invoke(objc, record.layer, 'setCornerRadius:', [radius]);
			record.cornerRadius = radius;
		}

		if (record.sheenLayer) {
			const layerBounds = await invoke(objc, record.layer, 'bounds');
			const sheenSignature = rectSignature(layerBounds);
			if (sheenSignature && sheenSignature !== record.sheenFrameSignature) {
				await invoke(objc, record.sheenLayer, 'setFrame:', [layerBounds]);
				record.sheenFrameSignature = sheenSignature;
			}
			if (Number.isFinite(radius) && radius !== record.sheenCornerRadius) {
				await invoke(objc, record.sheenLayer, 'setCornerRadius:', [radius]);
				record.sheenCornerRadius = radius;
			}
		}
	}

	async function createHolographicSheen(
		parentLayer: NativeObjectHandle,
	): Promise<NativeObjectHandle | null> {
		if (!resolvedBasicAnimationClass || (await reduceMotion)) return null;

		let sheenLayer: NativeObjectHandle | null = null;
		try {
			sheenLayer = (await invoke(
				objc,
				resolvedGradientLayerClass,
				'layer',
			)) as NativeObjectHandle | null;
			if (!sheenLayer) return null;

			const sheenColors = [
				await gradientColorObject(
					objc,
					resolvedArrayClass,
					resolvedUIColorClass,
					'#ffffff',
					0,
				),
				await gradientColorObject(
					objc,
					resolvedArrayClass,
					resolvedUIColorClass,
					'#ffffff',
					0.26,
				),
				await gradientColorObject(
					objc,
					resolvedArrayClass,
					resolvedUIColorClass,
					'#d8f4ff',
					0.34,
				),
				await gradientColorObject(
					objc,
					resolvedArrayClass,
					resolvedUIColorClass,
					'#ffffff',
					0.26,
				),
				await gradientColorObject(
					objc,
					resolvedArrayClass,
					resolvedUIColorClass,
					'#ffffff',
					0,
				),
			];
			if (sheenColors.some((color) => !color)) return null;

			await invoke(objc, sheenLayer, 'setColors:', [sheenColors]);
			await invoke(objc, sheenLayer, 'setLocations:', [[0, 0.1, 0.2, 0.3, 0.4]]);
			await invoke(objc, sheenLayer, 'setStartPoint:', [
				objc.struct('CGPoint', { x: 0, y: 0 }),
			]);
			await invoke(objc, sheenLayer, 'setEndPoint:', [
				objc.struct('CGPoint', { x: 1, y: 0 }),
			]);
			await invoke(objc, sheenLayer, 'setMasksToBounds:', [true]);
			await invoke(objc, sheenLayer, 'setZPosition:', [1]);
			await invoke(objc, parentLayer, 'addSublayer:', [sheenLayer]);

			const animation = (await invoke(
				objc,
				resolvedBasicAnimationClass,
				'animationWithKeyPath:',
				['locations'],
			)) as NativeObjectHandle | null;
			if (!animation) return sheenLayer;

			await invoke(objc, animation, 'setFromValue:', [[0, 0.1, 0.2, 0.3, 0.4]]);
			await invoke(objc, animation, 'setToValue:', [[0.6, 0.7, 0.8, 0.9, 1]]);
			await invoke(objc, animation, 'setDuration:', [3.2]);
			await invoke(objc, animation, 'setAutoreverses:', [true]);
			await invoke(objc, animation, 'setRepeatCount:', [100000]);
			await invoke(objc, animation, 'setRemovedOnCompletion:', [false]);

			if (resolvedTimingFunctionClass) {
				const timingFunction = (await invoke(
					objc,
					resolvedTimingFunctionClass,
					'functionWithName:',
					['easeInEaseOut'],
				)) as NativeObjectHandle | null;
				if (timingFunction)
					await invoke(objc, animation, 'setTimingFunction:', [timingFunction]);
			}

			await invoke(objc, sheenLayer, 'addAnimation:forKey:', [
				animation,
				'more-user-tags.holographic-sheen',
			]);
			return sheenLayer;
		} catch {
			if (sheenLayer) {
				const failedSheenLayer = sheenLayer;
				await attempt(() => invoke(objc, failedSheenLayer, 'removeFromSuperlayer'));
			}
			return null;
		}
	}

	async function removeHolographicSheen(record: TagGradientRecord): Promise<void> {
		const sheenLayer = record.sheenLayer;
		if (!sheenLayer) return;
		await attempt(() => invoke(objc, sheenLayer, 'removeFromSuperlayer'));
		record.sheenLayer = null;
		record.sheenFrameSignature = '';
		record.sheenCornerRadius = null;
	}

	async function applyAppearance(
		record: TagGradientRecord,
		appearance: RoleColorAppearance,
	): Promise<boolean> {
		const { colors, style } = appearance;
		if (colors.length < 1 || colors.some((color) => !/^#[\da-f]{6}$/i.test(color)))
			return false;

		try {
			const background = (await invoke(
				objc,
				record.label,
				'backgroundColor',
			)) as NativeObjectHandle | null;
			if (!(await isTransparent(background))) {
				if (background) record.originalBackground = background;
				await invoke(objc, record.label, 'setBackgroundColor:', [await clearColor]);
			}
			if (await invoke(objc, record.label, 'isOpaque'))
				await invoke(objc, record.label, 'setOpaque:', [false]);

			if (record.colors.join(':') !== colors.join(':') || record.style !== style) {
				const renderColors = colors.length === 1 ? [colors[0], colors[0]] : colors;
				const cgColors = await Promise.all(
					renderColors.map((color) =>
						gradientColorObject(objc, resolvedArrayClass, resolvedUIColorClass, color),
					),
				);
				if (cgColors.some((color) => !color)) return false;

				await invoke(objc, record.layer, 'setColors:', [cgColors]);
				await invoke(objc, record.layer, 'setLocations:', [
					renderColors.map((_, index) => index / (renderColors.length - 1)),
				]);
				await invoke(objc, record.layer, 'setStartPoint:', [
					objc.struct('CGPoint', { x: 0, y: 0 }),
				]);
				await invoke(objc, record.layer, 'setEndPoint:', [
					objc.struct('CGPoint', { x: 1, y: 0 }),
				]);
				await invoke(objc, record.layer, 'setMasksToBounds:', [true]);
				await invoke(objc, record.layer, 'setNeedsDisplay');

				if (style === 'holographic') {
					record.sheenLayer ??= await createHolographicSheen(record.layer);
				} else {
					await removeHolographicSheen(record);
				}

				record.colors = [...colors];
			}

			record.style = style;

			await updateFrame(record);
			return true;
		} catch {
			return false;
		}
	}

	async function createRecord(
		label: NativeObjectHandle,
		labelName: string,
		primaryColor: string,
		appearance: RoleColorAppearance,
	): Promise<TagGradientRecord | null> {
		let layer: NativeObjectHandle | null = null;
		let originalBackground: NativeObjectHandle | null = null;
		let associated = false;
		const id = await viewIdentifier(objc, label);
		if (!(await clearColor)) return null;

		try {
			const parent = (await invoke(objc, label, 'superview')) as NativeObjectHandle | null;
			if (!parent) return null;

			const parentLayer = (await invoke(objc, parent, 'layer')) as NativeObjectHandle | null;
			if (!parentLayer) return null;

			layer = (await invoke(
				objc,
				resolvedGradientLayerClass,
				'layer',
			)) as NativeObjectHandle | null;
			if (!layer) return null;

			originalBackground = (await invoke(
				objc,
				label,
				'backgroundColor',
			)) as NativeObjectHandle | null;
			const originalOpaque = Boolean(await invoke(objc, label, 'isOpaque'));
			const labelLayer = (await invoke(objc, label, 'layer')) as NativeObjectHandle;
			if (stopped) return null;
			const record: TagGradientRecord = {
				id,
				label,
				layer,
				frameSignature: '',
				cornerRadius: null,
				sheenFrameSignature: '',
				sheenCornerRadius: null,
				originalBackground,
				originalOpaque,
				labelName,
				primaryColor,
				colors: [],
				style: 'solid',
				sheenLayer: null,
			};

			await invoke(objc, parentLayer, 'insertSublayer:below:', [layer, labelLayer]);
			objc.setAssociatedObject(label, associationKey, layer, 'retain');
			associated = true;
			await invoke(objc, label, 'setBackgroundColor:', [await clearColor]);
			await invoke(objc, label, 'setOpaque:', [false]);
			records.set(id, record);

			if (!(await applyAppearance(record, appearance))) {
				await removeRecord(record, true);
				return null;
			}

			return record;
		} catch {
			const failedLayer = layer;
			if (failedLayer) await attempt(() => invoke(objc, failedLayer, 'removeFromSuperlayer'));
			if (associated) objc.setAssociatedObject(label, associationKey, null, 'assign');
			await attempt(() => invoke(objc, label, 'setBackgroundColor:', [originalBackground]));
			return null;
		}
	}

	async function labelColors(label: NativeObjectHandle, record?: TagGradientRecord) {
		const text = await invoke(objc, label, 'text');
		const accessibilityLabel = await invoke(objc, label, 'accessibilityLabel');
		const labelName =
			typeof text === 'string' && text.length > 0
				? text
				: typeof accessibilityLabel === 'string'
					? accessibilityLabel
					: '';
		if (!labelName) return null;

		const background = (await invoke(
			objc,
			label,
			'backgroundColor',
		)) as NativeObjectHandle | null;
		const description = background ? await invoke(objc, background, 'description') : null;
		const color =
			typeof description === 'string' ? parseNativeColorDescription(description) : null;
		const primaryColor = color && color.alpha > 0 ? color.hex : (record?.primaryColor ?? null);
		const appearance = appearanceForLabel(appearances, labelName, primaryColor);
		return appearance ? { labelName, ...appearance } : null;
	}

	async function updateLabel(label: NativeObjectHandle): Promise<void> {
		if (stopped || appearances.size === 0 || objc.className(label) !== 'DCDLabel') return;

		const id = await viewIdentifier(objc, label);
		if (updating.has(id)) return;
		updating.add(id);

		try {
			let record = records.get(id);
			const result = await labelColors(label, record);
			if (stopped) return;
			if (!result) {
				if (record) await removeRecord(record, true);
				return;
			}

			if (
				record &&
				(record.labelName !== result.labelName ||
					record.primaryColor !== result.primaryColor)
			) {
				await removeRecord(record, true);
				record = undefined;
			}

			if (!record) {
				await createRecord(label, result.labelName, result.primaryColor, result.appearance);
				return;
			}

			if (!(await applyAppearance(record, result.appearance)))
				await removeRecord(record, true);
		} catch {
			return;
		} finally {
			updating.delete(id);
		}
	}

	async function scheduleLabelUpdate(label: NativeObjectHandle): Promise<void> {
		if (stopped || appearances.size === 0 || objc.className(label) !== 'DCDLabel') return;

		let retainedLabel: NativeObjectHandle;
		try {
			retainedLabel = objc.call(label, 'retain') as NativeObjectHandle;
		} catch {
			return;
		}

		const id = await viewIdentifier(objc, retainedLabel).catch(() => null);
		if (!id || stopped || pendingUpdates.has(id)) {
			await attempt(() => Promise.resolve(objc.call(retainedLabel, 'release')));
			return;
		}
		const timer = setTimeout(async () => {
			pendingUpdates.delete(id);
			try {
				await track(updateLabel(retainedLabel));
			} finally {
				await attempt(() => Promise.resolve(objc.call(retainedLabel, 'release')));
			}
		}, 0);
		pendingUpdates.set(id, { label: retainedLabel, timer });
	}

	function addHook(
		className: string,
		selector: string,
		handler: (target: NativeObjectHandle) => void | Promise<void>,
	): boolean {
		try {
			hookTokens.push(
				objc.hook(className, selector, {
					after: ({ self: target }) => track(Promise.resolve(handler(target))),
				}),
			);
			return true;
		} catch {
			return false;
		}
	}

	const backgroundHookAvailable = addHook('DCDLabel', 'setBackgroundColor:', scheduleLabelUpdate);
	const textHookAvailable = addHook('DCDLabel', 'setText:', scheduleLabelUpdate);
	const tagViewHookAvailable = addHook(
		'DiscordChat.MessageTagView',
		'layoutSubviews',
		async (view) => {
			if (stopped || appearances.size === 0) return;

			const retainedView = objc.call(view, 'retain') as NativeObjectHandle;
			try {
				for (const label of await nativeChildren(objc, retainedView)) {
					if (objc.className(label) === 'DCDLabel') await scheduleLabelUpdate(label);
				}
			} catch {
				return;
			} finally {
				objc.call(retainedView, 'release');
			}
		},
	);
	if (!backgroundHookAvailable && !textHookAvailable && !tagViewHookAvailable) return null;

	let reuseHook: ReturnType<NativeObjC['hook']> | null = null;
	if (objc.getClass('DCDMessageTableViewCell')) {
		try {
			reuseHook = objc.hook('DCDMessageTableViewCell', 'prepareForReuse', {
				after: ({ self: cell }) =>
					track(
						(async () => {
							const retainedCell = objc.call(cell, 'retain') as NativeObjectHandle;
							try {
								const queue = [{ view: retainedCell, depth: 0 }];
								while (queue.length > 0) {
									if (stopped) return;
									const current = queue.pop();
									if (!current) continue;
									if (objc.className(current.view) === 'DCDLabel') {
										const record = records.get(
											await viewIdentifier(objc, current.view),
										);
										if (record) await removeRecord(record, true);
										continue;
									}

									if (current.depth >= 8) continue;
									for (const child of (
										await nativeChildren(objc, current.view)
									).slice(0, 20)) {
										queue.push({
											view: child,
											depth: current.depth + 1,
										});
									}
								}
							} catch {
								return;
							} finally {
								objc.call(retainedCell, 'release');
							}
						})(),
					),
			});
		} catch {
			reuseHook = null;
		}
	}

	return {
		setAppearance(labels, appearance) {
			if (stopped) return;

			const normalizedColors = appearance.colors
				.filter((color) => /^#[\da-f]{6}$/i.test(color))
				.map((color) => color.toLowerCase());
			const primaryColor = normalizedColors[0];
			const normalizedAppearance = { colors: normalizedColors, style: appearance.style };

			for (const label of labels) {
				if (!label.trim()) continue;

				const key = primaryColor ? keyForLabel(label, primaryColor) : null;
				if (!key) {
					const prefix = `${label.trim().toLowerCase()}:`;
					for (const existingKey of appearances.keys()) {
						if (existingKey.startsWith(prefix)) appearances.delete(existingKey);
					}
					continue;
				}

				if (normalizedColors.length < 1) {
					appearances.delete(key);
					continue;
				}

				appearances.set(key, normalizedAppearance);
			}
		},
		async stop() {
			if (stopped) return;
			stopped = true;
			for (const { label, timer } of pendingUpdates.values()) {
				clearTimeout(timer);
				await attempt(() => Promise.resolve(objc.call(label, 'release')));
			}
			pendingUpdates.clear();
			for (const hook of hookTokens) hook.remove();
			reuseHook?.remove();
			await Promise.allSettled([...inFlight]);
			for (const record of [...records.values()])
				await attempt(() => removeRecord(record, true));
			appearances.clear();
		},
	};
}
