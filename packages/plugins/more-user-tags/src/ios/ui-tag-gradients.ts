import type { RoleColorStyle } from '@unbound-plugins/shared/colors/role-colors';
import type {
	NativeClassHandle,
	NativeObjCBridge,
	NativeObjectHandle,
	NativeUIScope,
} from '@unbound-app/api/native';

const STATE_KEY = '__unboundMoreUserTags';
const LABEL_CLASS = 'DCDLabel';
const TAG_VIEW_CLASS = 'DiscordChat.MessageTagView';
const CELL_CLASS = 'DCDMessageTableViewCell';
const HEX = /^#[\da-f]{6}$/i;
const SHEEN_KEY = 'more-user-tags.holographic-sheen';
const SHEEN_STOPS: GradientStop[] = [
	{ hex: '#ffffff', alpha: 0 },
	{ hex: '#ffffff', alpha: 0.26 },
	{ hex: '#d8f4ff', alpha: 0.34 },
	{ hex: '#ffffff', alpha: 0.26 },
	{ hex: '#ffffff', alpha: 0 },
];
const SHEEN_FROM = [0, 0.1, 0.2, 0.3, 0.4];
const SHEEN_TO = [0.6, 0.7, 0.8, 0.9, 1];
const MAX_COLORS = 256;

export type TagAppearance = {
	colors: string[];
	style: RoleColorStyle;
};

export type TagAppearanceTable = Record<string, TagAppearance>;

export type TagSettings = {
	appearances: TagAppearanceTable;
	reduceMotion: boolean;
};

type GradientStop = {
	hex: string;
	alpha: number;
};

type Classes = {
	UIColor: NativeClassHandle;
	NSArray: NativeClassHandle;
	CAGradientLayer: NativeClassHandle;
	CABasicAnimation: NativeClassHandle | null;
	CAMediaTimingFunction: NativeClassHandle | null;
};

type TagRecord = {
	label: NativeObjectHandle;
	layer: NativeObjectHandle;
	sheen: NativeObjectHandle | null;
	labelName: string;
	primaryColor: string;
	signature: string;
	originalBackground: NativeObjectHandle | null;
	originalOpaque: boolean;
};

type TagState = {
	objc: NativeObjCBridge;
	classes: Classes;
	settings: TagSettings;
	clear: NativeObjectHandle;
	cgColors: Map<string, NativeObjectHandle>;
	records: Map<string, TagRecord>;
	updating: Set<string>;
};

type StateHolder = Record<typeof STATE_KEY, TagState | undefined>;

type Match = {
	labelName: string;
	primaryColor: string;
	appearance: TagAppearance;
};

export type TagCounts = {
	painted: number;
	problems: string[];
};

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function keyOf(objc: NativeObjCBridge, view: NativeObjectHandle): string {
	'worklet';

	return String(objc.call(view, 'hash'));
}

function gradientKey(label: string, color: string): string {
	'worklet';

	return `${label.trim().toLowerCase()}:${color.toLowerCase()}`;
}

function componentHex(component: number): string {
	'worklet';

	return Math.round(component * 255)
		.toString(16)
		.padStart(2, '0');
}

function describedColor(description: unknown): GradientStop | null {
	'worklet';

	if (typeof description !== 'string') {
		return null;
	}

	const parts = description.trim().split(/\s+/);
	const space = parts[0];
	const values = parts.slice(1).map(Number);
	let channels: number[];
	let alpha: number;

	if (space === 'UIExtendedSRGBColorSpace' && values.length === 4) {
		channels = values.slice(0, 3);
		alpha = values[3] ?? 0;
	} else if (space === 'UIExtendedGrayColorSpace' && values.length === 2) {
		channels = [values[0] ?? 0, values[0] ?? 0, values[0] ?? 0];
		alpha = values[1] ?? 0;
	} else {
		return null;
	}

	if (channels.some((channel) => !(channel >= 0 && channel <= 1)) || !(alpha >= 0)) {
		return null;
	}

	return { hex: `#${channels.map(componentHex).join('')}`, alpha };
}

function cgColor(current: TagState, stop: GradientStop): NativeObjectHandle | null {
	'worklet';
	const key = `${stop.hex.toLowerCase()}:${stop.alpha}`;
	const cached = current.cgColors.get(key);

	if (cached) {
		return cached;
	}

	if (!HEX.test(stop.hex)) {
		return null;
	}

	const { objc, classes } = current;
	const value = Number.parseInt(stop.hex.slice(1), 16);
	const color = objc.call(
		classes.UIColor,
		'colorWithRed:green:blue:alpha:',
		((value >> 16) & 0xff) / 255,
		((value >> 8) & 0xff) / 255,
		(value & 0xff) / 255,
		stop.alpha,
	) as NativeObjectHandle | null;
	const pointer = color ? objc.invoke(color, 'CGColor', []) : null;
	const boxed = pointer ? objc.invoke(classes.NSArray, 'arrayWithObject:', [pointer]) : null;
	const handle = Array.isArray(boxed) ? (boxed[0] as NativeObjectHandle | undefined) : undefined;

	if (!handle || typeof handle !== 'object') {
		return null;
	}

	if (current.cgColors.size >= MAX_COLORS) {
		current.cgColors.clear();
	}

	current.cgColors.set(key, handle);

	return handle;
}

function isTransparent(current: TagState, color: NativeObjectHandle | null): boolean {
	'worklet';

	if (!color) {
		return false;
	}

	if (current.objc.call(color, 'isEqual:', current.clear)) {
		return true;
	}

	return describedColor(current.objc.call(color, 'description'))?.alpha === 0;
}

function findAppearance(
	current: TagState,
	labelName: string,
	primaryColor: string | null,
): Match | null {
	'worklet';
	const { appearances } = current.settings;

	if (primaryColor) {
		const appearance = appearances[gradientKey(labelName, primaryColor)];

		if (appearance) {
			return { labelName, primaryColor, appearance };
		}
	}

	const prefix = gradientKey(labelName, '');
	let found: Match | null = null;
	let signature = '';

	for (const key of Object.keys(appearances)) {
		const appearance = appearances[key];

		if (!key.startsWith(prefix) || !appearance) {
			continue;
		}

		const next = `${appearance.style}:${appearance.colors.join(':')}`;

		if (found && next !== signature) {
			return null;
		}

		found = { labelName, primaryColor: key.slice(prefix.length), appearance };
		signature = next;
	}

	return found;
}

function readLabel(
	current: TagState,
	label: NativeObjectHandle,
	record: TagRecord | undefined,
): Match | null {
	'worklet';
	const { objc } = current;
	const text = objc.invoke(label, 'text', []);
	const accessibilityLabel = objc.invoke(label, 'accessibilityLabel', []);
	const labelName =
		typeof text === 'string' && text.length > 0
			? text
			: typeof accessibilityLabel === 'string'
				? accessibilityLabel
				: '';

	if (!labelName) {
		return null;
	}

	const background = objc.invoke(label, 'backgroundColor', []) as NativeObjectHandle | null;
	const color = background ? describedColor(objc.call(background, 'description')) : null;
	const primaryColor = color && color.alpha > 0 ? color.hex : (record?.primaryColor ?? null);

	return findAppearance(current, labelName, primaryColor);
}

function pointHorizontally(objc: NativeObjCBridge, layer: NativeObjectHandle) {
	'worklet';
	objc.invoke(layer, 'setStartPoint:', [objc.struct('CGPoint', { x: 0, y: 0 })]);
	objc.invoke(layer, 'setEndPoint:', [objc.struct('CGPoint', { x: 1, y: 0 })]);
}

function addSheen(current: TagState, parent: NativeObjectHandle): NativeObjectHandle | null {
	'worklet';
	const { objc, classes } = current;

	if (!classes.CABasicAnimation || current.settings.reduceMotion) {
		return null;
	}

	const stops = SHEEN_STOPS.map((stop) => cgColor(current, stop));

	if (stops.some((stop) => !stop)) {
		return null;
	}

	const sheen = objc.call(classes.CAGradientLayer, 'layer') as NativeObjectHandle | null;
	const animation = objc.call(
		classes.CABasicAnimation,
		'animationWithKeyPath:',
		'locations',
	) as NativeObjectHandle | null;

	if (!sheen || !animation) {
		return null;
	}

	objc.invoke(sheen, 'setColors:', [stops]);
	objc.invoke(sheen, 'setLocations:', [SHEEN_FROM]);
	pointHorizontally(objc, sheen);
	objc.invoke(sheen, 'setMasksToBounds:', [true]);
	objc.invoke(sheen, 'setZPosition:', [1]);
	objc.invoke(parent, 'addSublayer:', [sheen]);
	objc.invoke(animation, 'setFromValue:', [SHEEN_FROM]);
	objc.invoke(animation, 'setToValue:', [SHEEN_TO]);
	objc.invoke(animation, 'setDuration:', [3.2]);
	objc.invoke(animation, 'setAutoreverses:', [true]);
	objc.invoke(animation, 'setRepeatCount:', [100000]);
	objc.invoke(animation, 'setRemovedOnCompletion:', [false]);

	if (classes.CAMediaTimingFunction) {
		const timing = objc.call(
			classes.CAMediaTimingFunction,
			'functionWithName:',
			'easeInEaseOut',
		) as NativeObjectHandle | null;

		if (timing) {
			objc.invoke(animation, 'setTimingFunction:', [timing]);
		}
	}

	objc.invoke(sheen, 'addAnimation:forKey:', [animation, SHEEN_KEY]);

	return sheen;
}

function fit(current: TagState, record: TagRecord) {
	'worklet';
	const { objc } = current;
	const labelLayer = objc.invoke(record.label, 'layer', []) as NativeObjectHandle;
	const radius = Number(objc.invoke(labelLayer, 'cornerRadius', []));

	objc.invoke(record.layer, 'setFrame:', [objc.invoke(record.label, 'frame', [])]);
	objc.invoke(record.layer, 'setCornerRadius:', [radius]);

	if (record.sheen) {
		objc.invoke(record.sheen, 'setFrame:', [objc.invoke(record.layer, 'bounds', [])]);
		objc.invoke(record.sheen, 'setCornerRadius:', [radius]);
	}
}

function paint(current: TagState, record: TagRecord, appearance: TagAppearance): boolean {
	'worklet';
	const { objc } = current;
	const stops = appearance.colors;

	if (!stops.length || stops.some((color) => !HEX.test(color))) {
		return false;
	}

	const background = objc.invoke(
		record.label,
		'backgroundColor',
		[],
	) as NativeObjectHandle | null;

	if (!isTransparent(current, background)) {
		if (background) {
			record.originalBackground = background;
		}

		objc.invoke(record.label, 'setBackgroundColor:', [current.clear]);
	}

	if (objc.invoke(record.label, 'isOpaque', [])) {
		objc.invoke(record.label, 'setOpaque:', [false]);
	}

	const signature = `${appearance.style}:${stops.join(':')}`;

	if (record.signature !== signature) {
		const rendered = stops.length === 1 ? [stops[0] ?? '', stops[0] ?? ''] : stops;
		const colors = rendered.map((hex) => cgColor(current, { hex, alpha: 1 }));

		if (colors.some((color) => !color)) {
			return false;
		}

		objc.invoke(record.layer, 'setColors:', [colors]);
		objc.invoke(record.layer, 'setLocations:', [
			rendered.map((_, index) => index / (rendered.length - 1)),
		]);
		pointHorizontally(objc, record.layer);
		objc.invoke(record.layer, 'setMasksToBounds:', [true]);
		objc.invoke(record.layer, 'setNeedsDisplay', []);

		if (appearance.style === 'holographic') {
			record.sheen ??= addSheen(current, record.layer);
		} else if (record.sheen) {
			objc.invoke(record.sheen, 'removeFromSuperlayer', []);
			record.sheen = null;
		}

		record.signature = signature;
	}

	fit(current, record);

	return true;
}

function removeRecord(current: TagState, id: string, record: TagRecord) {
	'worklet';
	const { objc } = current;

	current.records.delete(id);
	objc.invoke(record.layer, 'removeFromSuperlayer', []);

	const background = objc.invoke(
		record.label,
		'backgroundColor',
		[],
	) as NativeObjectHandle | null;

	if (isTransparent(current, background)) {
		objc.invoke(record.label, 'setBackgroundColor:', [record.originalBackground]);
	}

	if (!objc.invoke(record.label, 'isOpaque', [])) {
		objc.invoke(record.label, 'setOpaque:', [record.originalOpaque]);
	}
}

function createRecord(
	current: TagState,
	label: NativeObjectHandle,
	match: Match,
): TagRecord | null {
	'worklet';
	const { objc, classes } = current;
	const parent = objc.invoke(label, 'superview', []) as NativeObjectHandle | null;
	const parentLayer = parent
		? (objc.invoke(parent, 'layer', []) as NativeObjectHandle | null)
		: null;
	const layer = parentLayer
		? (objc.call(classes.CAGradientLayer, 'layer') as NativeObjectHandle | null)
		: null;

	if (!parentLayer || !layer) {
		return null;
	}

	const record: TagRecord = {
		label,
		layer,
		sheen: null,
		labelName: match.labelName,
		primaryColor: match.primaryColor,
		signature: '',
		originalBackground: objc.invoke(label, 'backgroundColor', []) as NativeObjectHandle | null,
		originalOpaque: Boolean(objc.invoke(label, 'isOpaque', [])),
	};

	objc.invoke(parentLayer, 'insertSublayer:below:', [layer, objc.invoke(label, 'layer', [])]);

	return record;
}

function updateLabel(current: TagState, label: NativeObjectHandle) {
	'worklet';
	const { objc } = current;
	const id = keyOf(objc, label);

	if (current.updating.has(id)) {
		return;
	}

	current.updating.add(id);

	try {
		let record = current.records.get(id);
		const match = readLabel(current, label, record);

		if (!match) {
			if (record) {
				removeRecord(current, id, record);
			}

			return;
		}

		if (
			record &&
			(record.labelName !== match.labelName || record.primaryColor !== match.primaryColor)
		) {
			removeRecord(current, id, record);
			record = undefined;
		}

		record ??= createRecord(current, label, match) ?? undefined;

		if (!record) {
			return;
		}

		current.records.set(id, record);

		if (!paint(current, record, match.appearance)) {
			removeRecord(current, id, record);
		}
	} catch (error) {
		console.error(`[More User Tags] ${String(error)}`);
	} finally {
		current.updating.delete(id);
	}
}

function updateTagView(current: TagState, view: NativeObjectHandle) {
	'worklet';
	const subviews = current.objc.invoke(view, 'subviews', []);

	for (const child of Array.isArray(subviews) ? subviews : []) {
		if (
			current.objc.call(
				child as NativeObjectHandle,
				'isKindOfClass:',
				current.objc.getClass(LABEL_CLASS),
			)
		) {
			updateLabel(current, child as NativeObjectHandle);
		}
	}
}

function clearReusedCell(current: TagState, cell: NativeObjectHandle) {
	'worklet';

	const reused: string[] = [];

	current.records.forEach((record, id) => {
		if (current.objc.call(record.label, 'isDescendantOfView:', cell)) {
			reused.push(id);
		}
	});

	for (const id of reused) {
		const record = current.records.get(id);

		if (record) {
			removeRecord(current, id, record);
		}
	}
}

function hasAppearances(current: TagState): boolean {
	'worklet';

	return Object.keys(current.settings.appearances).length > 0;
}

/**
 * @description Paints role gradients behind Discord's native user tags from hooks that run on the UI thread, in the same pass that sets the tag's text or color, so a tag is never drawn flat first.
 * @param scope The plugin's UI scope.
 * @param settings The gradients per label and color, and whether to skip the holographic sheen.
 * @returns Whether the native classes were found.
 */
export function installTagGradients(scope: NativeUIScope, settings: TagSettings): boolean {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const UIColor = objc.getClass('UIColor');
	const NSArray = objc.getClass('NSArray');
	const CAGradientLayer = objc.getClass('CAGradientLayer');

	if (!UIColor || !NSArray || !CAGradientLayer || !objc.getClass(LABEL_CLASS)) {
		return false;
	}

	const current: TagState = {
		objc,
		classes: {
			UIColor,
			NSArray,
			CAGradientLayer,
			CABasicAnimation: objc.getClass('CABasicAnimation'),
			CAMediaTimingFunction: objc.getClass('CAMediaTimingFunction'),
		},
		settings,
		clear: objc.call(UIColor, 'clearColor') as NativeObjectHandle,
		cgColors: new Map(),
		records: new Map(),
		updating: new Set(),
	};

	holder()[STATE_KEY] = current;

	const onLabel = ({ self }: { self: NativeObjectHandle }) => {
		if (hasAppearances(current)) {
			updateLabel(current, self);
		}
	};

	objc.hook(LABEL_CLASS, 'setText:', { after: onLabel });
	objc.hook(LABEL_CLASS, 'setBackgroundColor:', { after: onLabel });

	if (objc.getClass(TAG_VIEW_CLASS)) {
		objc.hook(TAG_VIEW_CLASS, 'layoutSubviews', {
			after: ({ self }) => {
				if (hasAppearances(current)) {
					updateTagView(current, self);
				}
			},
		});
	}

	if (objc.getClass(CELL_CLASS)) {
		objc.hook(CELL_CLASS, 'prepareForReuse', {
			after: ({ self }) => clearReusedCell(current, self),
		});
	}

	return true;
}

/**
 * @description Replaces the gradients and repaints the tags it painted.
 * @param settings The gradients per label and color, and whether to skip the holographic sheen.
 */
export function setTagSettings(settings: TagSettings) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) {
		return;
	}

	current.settings = settings;

	for (const record of [...current.records.values()]) {
		updateLabel(current, record.label);
	}
}

/**
 * @description Removes every gradient and gives each tag its own background back.
 */
export function removeTagGradients() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) {
		return;
	}

	for (const id of [...current.records.keys()]) {
		const record = current.records.get(id);

		try {
			if (record) {
				removeRecord(current, id, record);
			}
		} catch (error) {
			console.error(`[More User Tags] ${String(error)}`);
		}
	}

	holder()[STATE_KEY] = undefined;
}

/**
 * @description Counts the painted tags and lists those whose gradient lost its layer or size.
 * @returns The count and the problems.
 */
export function inspectTagGradients(): TagCounts {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) {
		return { painted: 0, problems: [] };
	}

	const problems: string[] = [];

	for (const record of current.records.values()) {
		if (!current.objc.invoke(record.layer, 'superlayer', [])) {
			problems.push(`${record.labelName} lost its gradient layer`);
		}
	}

	return { painted: current.records.size, problems };
}

export default { installTagGradients, setTagSettings, removeTagGradients, inspectTagGradients };
