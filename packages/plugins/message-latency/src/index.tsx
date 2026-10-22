import {
	SettingsRow,
	SettingsScrollView,
	SettingsSection,
	SettingsSwitchRow,
} from '@shared/settings-ui';
import { metro, patcher, storage } from '@unbound-app/api';
import type {
	NativeFabricBridge,
	NativeFabricSurface,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
	NativeViewSnapshotNode,
	PluginContext,
} from '@unbound-app/api/native';
import type { ReactNode } from 'react';

const ADDON_ID = 'unbound.message-latency';
const ANDROID_NONCE_OFFSET = 1_471_228_928;
const ANDROID_OFFSET_TOLERANCE = 86_400_000;
const DISCORD_EPOCH = 1_420_070_400_000;
const SNOWFLAKE_SHIFT = 4_194_304;
const LATENCY_OPTIONS = [1, 2, 3, 5, 10];
const LATENCY_ICON_WIDTH = 12;
const LATENCY_ICON_HEIGHT = 12;
const LATENCY_CONTROL_WIDTH = 16;
const LATENCY_CONTROL_HEIGHT = 20;
const LATENCY_ROW_RESERVATION = LATENCY_CONTROL_WIDTH;
const TOOLTIP_MAX_WIDTH = 250;
const TOOLTIP_ARROW_HEIGHT = 8;
const TOOLTIP_ANCHOR_GAP = 3;
const LAYOUT_ATTRIBUTE_CENTER_Y = 10;
const LAYOUT_ATTRIBUTE_HEIGHT = 8;
const LAYOUT_ATTRIBUTE_LEADING = 5;
const LAYOUT_ATTRIBUTE_NOT_AN_ATTRIBUTE = 0;
const LAYOUT_ATTRIBUTE_TRAILING = 6;
const LAYOUT_ATTRIBUTE_WIDTH = 7;
const LAYOUT_RELATION_EQUAL = 0;
const MAX_LATENCY_RECORDS = 500;
const MAX_CELL_NODES = 120;
const MAX_CELL_DEPTH = 12;
const STORE = storage.getStore(ADDON_ID);

type LatencyColor = 'danger' | 'muted' | 'positive' | 'warning';
type LatencyFill = [LatencyColor, LatencyColor, LatencyColor];

interface LatencyMessage {
	author?: { bot?: boolean; id?: string; username?: string };
	id?: unknown;
	nonce?: unknown;
}

interface Dispatcher {
	subscribe?: (event: string, listener: (event: Record<string, unknown>) => void) => void;
	unsubscribe?: (event: string, listener: (event: Record<string, unknown>) => void) => void;
}

interface LatencyOptions {
	detectDiscordKotlin: boolean;
	ignoreSelf: boolean;
	latency: number;
	showMillis: boolean;
}

interface ThemeModule {
	colors: Record<string, unknown>;
	internal: {
		resolveSemanticColor: (theme: string, color: unknown) => string;
	};
	themes: Record<string, string>;
}

interface ThemeStore {
	addChangeListener?: (listener: () => void) => void;
	removeChangeListener?: (listener: () => void) => void;
	theme?: string;
}

interface LatencyDetails {
	ahead: boolean;
	androidClient: boolean;
	delta: number;
	displayDelta: string | null;
	fill: LatencyFill;
}

interface MessageRowData {
	username?: unknown;
}

interface RowPatchContext {
	args: Array<{ message?: LatencyMessage }>;
	result?: { message?: MessageRowData };
}

interface LatencyRecord {
	details: LatencyDetails;
	messageId: string;
	tooltip: string;
	username: string;
}

interface NativeFrame {
	height: number;
	width: number;
	x: number;
	y: number;
}

interface LatencyViewState {
	cellKey: string;
	fillKey: string;
	icon: NativeObjectHandle;
	layout: LatencyLayoutState;
	messageId: string;
	tooltip: string;
	username: string;
}

interface LatencyConstraintState {
	constraint: NativeObjectHandle;
	container: NativeObjectHandle;
}

interface LatencyFrameState {
	frame: NativeFrame;
	translates: boolean;
	view: NativeObjectHandle;
}

interface LatencyViewFrame {
	frame: NativeFrame;
	view: NativeObjectHandle;
}

interface LatencyLayoutState {
	constraints: LatencyConstraintState[];
	views: LatencyFrameState[];
}

interface LatencyTooltipProps {
	arrowDirection: 'UP' | 'DOWN';
	arrowOffset: number;
	label: string;
	width: number;
}

interface TooltipModule {
	Tooltip: (props: Record<string, unknown>) => ReactNode;
	TooltipArrowPositions: { LEFT: string };
}

type LatencyConstraintSpec = readonly [
	NativeObjectHandle,
	number,
	NativeObjectHandle | null,
	number,
	number,
];

let rowUnpatch: (() => void) | null = null;
let users: { getCurrentUser?: () => { id?: string } | null } | null = null;
let themeStore: ThemeStore | null = null;
let objc: NativeObjCBridge | null = null;
let fabric: NativeFabricBridge | null = null;
let started = false;
let activeTooltip: NativeObjectHandle | null = null;
let activeTooltipSurface: NativeFabricSurface | null = null;
let activeTooltipOwnerKey: string | null = null;
let tooltipTimer: ReturnType<typeof setTimeout> | null = null;
let tooltipDismissHook: NativeHookToken | null = null;
let tooltipGeneration = 0;
const tooltipTasks = new Set<Promise<void>>();
let tooltipSurfaceModuleName = '';
let removeModuleListener: (() => boolean) | null = null;
let removeMessageCreateListener: (() => void) | null = null;
let removeThemeListener: (() => void) | null = null;
let lifecycle = 0;
let cleanupTask: Promise<void> | null = null;
let cellHooks: NativeHookToken[] = [];
const latencyRecords = new Map<string, LatencyRecord>();
const activeCells = new Map<string, NativeObjectHandle>();
const activeCellMessageIds = new Map<string, string>();
const cellsByMessageId = new Map<string, NativeObjectHandle>();
const pendingCells = new Set<string>();
const cellRevisions = new Map<string, number>();
const cellQueues = new Map<string, Promise<void>>();
const cellTasks = new Set<Promise<void>>();
let nextCellRevision = 0;
const latencyViews = new Map<string, LatencyViewState>();

export function snowflakeTimestamp(value: unknown): number | null {
	if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
	const digits = String(value);
	if (!/^\d+$/.test(digits)) return null;

	let remainder = 0;
	let quotient = '';
	for (const digit of digits) {
		const current = remainder * 10 + Number(digit);
		const next = Math.floor(current / SNOWFLAKE_SHIFT);
		remainder = current % SNOWFLAKE_SHIFT;
		if (quotient || next) quotient += String(next);
	}

	if (!quotient) return null;
	const timestamp = DISCORD_EPOCH + Number(quotient);
	return Number.isSafeInteger(timestamp) ? timestamp : null;
}

export function formatLatency(delta: number, showMillis: boolean): string {
	const values: Array<[number, string]> = [
		[Math.floor(delta / 86_400_000), 'days'],
		[Math.floor((delta / 3_600_000) % 24), 'hours'],
		[Math.floor((delta / 60_000) % 60), 'minutes'],
		[Math.floor((delta / 1000) % 60), 'seconds'],
		[Math.floor(delta % 1000), 'milliseconds'],
	];
	let result = '';

	for (const [value, unit] of values) {
		if (!value) continue;
		const part = `${value} ${value > 1 ? unit : unit.slice(0, -1)}`;
		if (result) {
			const separator = showMillis ? unit === 'milliseconds' : unit === 'seconds';
			result += separator ? ' and ' : ' ';
		}
		result += part;
	}

	return result || '0 seconds';
}

export function latencyDetails(
	message: LatencyMessage,
	currentUserId: string | undefined,
	options: LatencyOptions,
): LatencyDetails | null {
	if (message.nonce == null || message.author?.bot) return null;
	if (options.ignoreSelf && message.author?.id === currentUserId) return null;

	const messageTimestamp = snowflakeTimestamp(message.id);
	const nonceTimestamp = snowflakeTimestamp(message.nonce);
	if (messageTimestamp == null || nonceTimestamp == null) return null;

	let delta = messageTimestamp - nonceTimestamp;
	if (!options.showMillis) delta = Math.round(delta / 1000) * 1000;

	let androidClient = false;
	if (-delta >= ANDROID_NONCE_OFFSET - ANDROID_OFFSET_TOLERANCE) {
		androidClient = options.detectDiscordKotlin;
		delta += ANDROID_NONCE_OFFSET;
	}

	const absoluteDelta = Math.abs(delta);
	const ahead = absoluteDelta !== delta;
	const displayDelta =
		absoluteDelta >= options.latency * 1000
			? formatLatency(absoluteDelta, options.showMillis)
			: null;
	const fill: LatencyFill = androidClient
		? ['positive', 'positive', 'muted']
		: delta >= 120_000 || ahead
			? ['muted', 'muted', 'muted']
			: delta >= options.latency * 2000
				? ['danger', 'muted', 'muted']
				: ['warning', 'warning', 'muted'];

	if (displayDelta === null && !androidClient) return null;
	return { ahead, androidClient, delta: absoluteDelta, displayDelta, fill };
}

export function latencyTooltip(details: LatencyDetails): string {
	if (!details.displayDelta) return 'User is suspected to be on an old Discord Android client';
	const message = details.ahead
		? `This user's clock is ${details.displayDelta} ahead.`
		: `This message was sent with a delay of ${details.displayDelta}.`;
	return details.androidClient
		? `${message} User is suspected to be on an old Discord Android client.`
		: message;
}

export function messageFromCreateEvent(event: Record<string, unknown>): LatencyMessage | null {
	const message = event.message;
	if (!message || typeof message !== 'object') return null;
	return message as LatencyMessage;
}

function currentOptions(): LatencyOptions {
	return {
		detectDiscordKotlin: STORE.get('detectDiscordKotlin', true),
		ignoreSelf: STORE.get('ignoreSelf', false),
		latency: STORE.get('latency', 2),
		showMillis: STORE.get('showMillis', false),
	};
}

async function nativeCallAsync(
	handle: NativeObjectHandle,
	selector: string,
	...args: unknown[]
): Promise<unknown> {
	if (!objc) return null;
	try {
		return await objc.invokeAsync(handle, selector, args);
	} catch {
		return null;
	}
}

function trackTooltipTask(task: Promise<void>): void {
	const settled = task.catch(() => undefined);
	tooltipTasks.add(settled);
	void settled.finally(() => tooltipTasks.delete(settled));
}

function nativeKey(handle: NativeObjectHandle): string | null {
	try {
		const value = objc?.call(handle, 'hash');
		return value == null ? null : `${objc?.className(handle) ?? 'NSObject'}:${String(value)}`;
	} catch {
		return null;
	}
}

function nativeArray(value: unknown): NativeObjectHandle[] {
	if (Array.isArray(value)) return value as NativeObjectHandle[];
	if (!objc || !value || typeof value !== 'object') return [];
	try {
		return objc.array(value as NativeObjectHandle) as NativeObjectHandle[];
	} catch {
		return [];
	}
}

function frameFromRect(value: unknown): NativeFrame | null {
	const rect = (value as { value?: unknown } | null)?.value ?? value;
	if (!rect || typeof rect !== 'object') return null;
	const origin = (rect as { origin?: Record<string, unknown> }).origin;
	const size = (rect as { size?: Record<string, unknown> }).size;
	if (!origin || !size) return null;
	const x = Number(origin.x);
	const y = Number(origin.y);
	const width = Number(size.width);
	const height = Number(size.height);
	if (![x, y, width, height].every(Number.isFinite)) return null;
	return { height, width, x, y };
}

async function nativeFrame(view: NativeObjectHandle): Promise<NativeFrame | null> {
	return frameFromRect(await nativeCallAsync(view, 'frame'));
}

async function setNativeFrameAsync(view: NativeObjectHandle, frame: NativeFrame): Promise<void> {
	if (!objc) return;
	await nativeCallAsync(
		view,
		'setFrame:',
		objc.struct('CGRect', {
			origin: { x: frame.x, y: frame.y },
			size: { width: frame.width, height: frame.height },
		}),
	);
}

async function cellMessageId(cell: NativeObjectHandle): Promise<string | null> {
	if (!objc) return null;
	try {
		const viewModel = objc.getIvar(cell, 'viewModel') as NativeObjectHandle | null;
		if (!viewModel) return null;
		const values = await objc.batch([
			{ target: viewModel, selector: 'message', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'id', args: [] },
		]);
		const id = values[1];
		return id == null ? null : String(id);
	} catch {
		return null;
	}
}

function labelForUsername(nodes: NativeViewSnapshotNode[], username: string): number {
	const exact = nodes.findIndex(
		(node) =>
			node.className === 'DCDLabel' &&
			node.text === username &&
			node.frame.width > 0 &&
			node.frame.height > 0,
	);
	if (exact >= 0) return exact;
	let candidate = -1;
	for (let index = 0; index < nodes.length; index++) {
		const node = nodes[index];
		if (
			node.className !== 'DCDLabel' ||
			!node.text ||
			node.frame.width <= 0 ||
			node.frame.height <= 0 ||
			!headerForUsername(nodes, index)
		)
			continue;
		if (candidate >= 0) return -1;
		candidate = index;
	}
	return candidate;
}

function headerForUsername(
	nodes: NativeViewSnapshotNode[],
	labelIndex: number,
): NativeObjectHandle | null {
	const label = nodes[labelIndex];
	if (!label) return null;
	let parentIndex = label.parent;
	for (let depth = 0; parentIndex >= 0 && depth < 8; depth++) {
		const parent = nodes[parentIndex];
		if (!parent) return null;
		const frame = parent.frame;
		if (
			frame.height <= label.frame.height + 4 &&
			frame.width >= 120 &&
			frame.width > label.frame.width * 1.5
		) {
			return parent.view;
		}
		parentIndex = parent.parent;
	}
	return null;
}

async function iconColors(fill: LatencyFill): Promise<Array<NativeObjectHandle | null>> {
	if (!objc) return [];
	const theme = metro.common.Theme as ThemeModule;
	const appearance = themeStore?.theme ?? theme.themes.DARK;
	const tokens: Record<LatencyColor, string> = {
		danger: 'STATUS_DANGER',
		muted: 'TEXT_MUTED',
		positive: 'STATUS_POSITIVE',
		warning: 'STATUS_WARNING',
	};
	const uiColor = objc.getClass('UIColor');
	if (!uiColor) return [];
	return Promise.all(
		fill.map(async (color) => {
			try {
				const hex = theme.internal.resolveSemanticColor(
					appearance,
					theme.colors[tokens[color]],
				);
				const match = /^#([0-9a-f]{6})$/i.exec(hex);
				if (!match?.[1]) return null;
				const value = Number.parseInt(match[1], 16);
				return (await nativeCallAsync(
					uiColor,
					'colorWithRed:green:blue:alpha:',
					((value >> 16) & 255) / 255,
					((value >> 8) & 255) / 255,
					(value & 255) / 255,
					1,
				)) as NativeObjectHandle;
			} catch {
				return null;
			}
		}),
	);
}

async function createLatencyIcon(record: LatencyRecord): Promise<NativeObjectHandle | null> {
	if (!objc) return null;
	const view = objc.alloc('UIButton');
	await nativeCallAsync(view, 'setUserInteractionEnabled:', true);
	await nativeCallAsync(view, 'setExclusiveTouch:', true);
	await nativeCallAsync(view, 'setIsAccessibilityElement:', true);
	await nativeCallAsync(view, 'setAccessibilityIdentifier:', 'message-latency');
	await nativeCallAsync(
		view,
		'setAccessibilityLabel:',
		record.details.displayDelta ?? 'Old Discord Android client',
	);
	await nativeCallAsync(view, 'setAccessibilityHint:', record.tooltip);
	const colors = await iconColors(record.details.fill);
	if (colors.length !== 3 || colors.some((color) => !color)) return null;
	const bars = [
		{ height: 2.4, width: 2.4, x: 1.2, y: 12.4 },
		{ height: 6, width: 2.4, x: 4.8, y: 8.8 },
		{ height: 9.6, width: 2.4, x: 8.4, y: 5.2 },
	];
	for (let index = 0; index < bars.length; index++) {
		const bar = objc.alloc('UIView');
		const frame = bars[index];
		const color = colors[index];
		if (!frame || !color) continue;
		await setNativeFrameAsync(bar, frame);
		await nativeCallAsync(bar, 'setUserInteractionEnabled:', false);
		await nativeCallAsync(bar, 'setBackgroundColor:', color);
		const layer = (await nativeCallAsync(bar, 'layer')) as NativeObjectHandle | null;
		if (layer) await nativeCallAsync(layer, 'setCornerRadius:', 0.5);
		await nativeCallAsync(view, 'addSubview:', bar);
	}
	return view;
}

async function captureLatencyFrame(view: NativeObjectHandle): Promise<LatencyFrameState> {
	const frame = await nativeFrame(view);
	if (!frame) throw new Error('Failed to read message latency layout frame');
	return {
		frame,
		translates: Boolean(
			await nativeCallAsync(view, 'translatesAutoresizingMaskIntoConstraints'),
		),
		view,
	};
}

async function removeLatencyConstraints(constraints: LatencyConstraintState[]): Promise<void> {
	if (!objc) return;
	for (const { constraint, container } of constraints) {
		await nativeCallAsync(container, 'removeConstraint:', constraint);
	}
}

async function restoreLatencyLayout(layout: LatencyLayoutState): Promise<void> {
	await removeLatencyConstraints(layout.constraints);
	for (const { frame, translates, view } of layout.views) {
		await setNativeFrameAsync(view, frame);
		await nativeCallAsync(view, 'setTranslatesAutoresizingMaskIntoConstraints:', translates);
	}
}

async function addLatencyConstraints(
	container: NativeObjectHandle,
	specs: LatencyConstraintSpec[],
	state: LatencyLayoutState,
): Promise<void> {
	if (!objc) throw new Error('Native Objective-C bridge is unavailable');
	const constraintClass = objc.getClass('NSLayoutConstraint');
	if (!constraintClass) throw new Error('NSLayoutConstraint is unavailable');
	for (const [firstItem, firstAttribute, secondItem, secondAttribute, constant] of specs) {
		const constraint = (await objc.invokeAsync(
			constraintClass,
			'constraintWithItem:attribute:relatedBy:toItem:attribute:multiplier:constant:',
			[
				firstItem,
				firstAttribute,
				LAYOUT_RELATION_EQUAL,
				secondItem,
				secondAttribute,
				1,
				constant,
			],
		)) as NativeObjectHandle | null;
		if (!constraint) throw new Error('Failed to create message latency layout constraint');
		await objc.invokeAsync(container, 'addConstraint:', [constraint]);
		state.constraints.push({ constraint, container });
	}
}

async function installLatencyLayout(
	icon: NativeObjectHandle,
	username: NativeObjectHandle,
	row: NativeObjectHandle,
): Promise<LatencyLayoutState> {
	if (!objc) throw new Error('Native Objective-C bridge is unavailable');
	const usernameWrapper = (await nativeCallAsync(
		username,
		'superview',
	)) as NativeObjectHandle | null;
	const group = usernameWrapper
		? ((await nativeCallAsync(usernameWrapper, 'superview')) as NativeObjectHandle | null)
		: null;
	const groupRow = group
		? ((await nativeCallAsync(group, 'superview')) as NativeObjectHandle | null)
		: null;
	if (!usernameWrapper || !group || !groupRow || nativeKey(groupRow) !== nativeKey(row)) {
		throw new Error('Message latency username row has an unsupported native layout');
	}
	const [groupFrame, rowFrame, usernameFrame] = await Promise.all([
		nativeFrame(group),
		nativeFrame(row),
		nativeFrame(usernameWrapper),
	]);
	if (!groupFrame || !rowFrame || !usernameFrame) {
		throw new Error('Message latency username row has an unsupported native frame');
	}
	const groupChildren = nativeArray(await nativeCallAsync(group, 'subviews')).filter(
		(view) => nativeKey(view) !== nativeKey(usernameWrapper),
	);
	const trailingViews = (
		await Promise.all(
			groupChildren.map(async (view) => ({
				frame: await nativeFrame(view),
				view,
			})),
		)
	)
		.filter((entry): entry is LatencyViewFrame =>
			Boolean(
				entry.frame &&
				entry.frame.width > 0 &&
				entry.frame.x >= usernameFrame.x + usernameFrame.width - 0.5,
			),
		)
		.sort((left, right) => left.frame.x - right.frame.x);
	const rowChildren = nativeArray(await nativeCallAsync(row, 'subviews'));
	const rowFrames = await Promise.all(
		rowChildren.map(async (view) => ({
			frame: await nativeFrame(view),
			view,
		})),
	);
	const timestampEntry = rowFrames.find(
		({ frame, view }) =>
			objc?.className(view) === 'DCDLabel' &&
			frame != null &&
			frame.width > 0 &&
			frame.x >= groupFrame.x + groupFrame.width - 0.5,
	);
	const timestamp = timestampEntry?.view;
	const timestampFrame = timestampEntry?.frame;
	if (!timestamp || !timestampFrame) {
		throw new Error('Message latency timestamp row is unavailable');
	}
	const layout: LatencyLayoutState = {
		constraints: [],
		views: await Promise.all(
			[group, usernameWrapper, ...trailingViews.map(({ view }) => view), timestamp].map(
				captureLatencyFrame,
			),
		),
	};
	try {
		for (const { view } of layout.views) {
			await nativeCallAsync(view, 'setTranslatesAutoresizingMaskIntoConstraints:', false);
		}
		await nativeCallAsync(icon, 'setTranslatesAutoresizingMaskIntoConstraints:', false);
		await nativeCallAsync(group, 'addSubview:', icon);
		await addLatencyConstraints(
			row,
			[
				[group, LAYOUT_ATTRIBUTE_LEADING, row, LAYOUT_ATTRIBUTE_LEADING, groupFrame.x],
				[group, LAYOUT_ATTRIBUTE_CENTER_Y, row, LAYOUT_ATTRIBUTE_CENTER_Y, 0],
				[
					group,
					LAYOUT_ATTRIBUTE_WIDTH,
					null,
					LAYOUT_ATTRIBUTE_NOT_AN_ATTRIBUTE,
					groupFrame.width + LATENCY_ROW_RESERVATION,
				],
				[
					group,
					LAYOUT_ATTRIBUTE_HEIGHT,
					null,
					LAYOUT_ATTRIBUTE_NOT_AN_ATTRIBUTE,
					groupFrame.height,
				],
				[
					timestamp,
					LAYOUT_ATTRIBUTE_LEADING,
					group,
					LAYOUT_ATTRIBUTE_TRAILING,
					timestampFrame.x - groupFrame.x - groupFrame.width,
				],
				[
					timestamp,
					LAYOUT_ATTRIBUTE_CENTER_Y,
					row,
					LAYOUT_ATTRIBUTE_CENTER_Y,
					timestampFrame.y + timestampFrame.height / 2 - rowFrame.height / 2,
				],
				[
					timestamp,
					LAYOUT_ATTRIBUTE_WIDTH,
					null,
					LAYOUT_ATTRIBUTE_NOT_AN_ATTRIBUTE,
					timestampFrame.width,
				],
				[
					timestamp,
					LAYOUT_ATTRIBUTE_HEIGHT,
					null,
					LAYOUT_ATTRIBUTE_NOT_AN_ATTRIBUTE,
					timestampFrame.height,
				],
			],
			layout,
		);
		const groupCenterOffset =
			usernameFrame.y + usernameFrame.height / 2 - groupFrame.height / 2;
		await addLatencyConstraints(
			group,
			[
				[icon, LAYOUT_ATTRIBUTE_LEADING, group, LAYOUT_ATTRIBUTE_LEADING, usernameFrame.x],
				[icon, LAYOUT_ATTRIBUTE_CENTER_Y, group, LAYOUT_ATTRIBUTE_CENTER_Y, 0],
				[
					icon,
					LAYOUT_ATTRIBUTE_WIDTH,
					null,
					LAYOUT_ATTRIBUTE_NOT_AN_ATTRIBUTE,
					LATENCY_CONTROL_WIDTH,
				],
				[
					icon,
					LAYOUT_ATTRIBUTE_HEIGHT,
					null,
					LAYOUT_ATTRIBUTE_NOT_AN_ATTRIBUTE,
					LATENCY_CONTROL_HEIGHT,
				],
				[usernameWrapper, LAYOUT_ATTRIBUTE_LEADING, icon, LAYOUT_ATTRIBUTE_TRAILING, 0],
				[
					usernameWrapper,
					LAYOUT_ATTRIBUTE_CENTER_Y,
					group,
					LAYOUT_ATTRIBUTE_CENTER_Y,
					groupCenterOffset,
				],
				[
					usernameWrapper,
					LAYOUT_ATTRIBUTE_WIDTH,
					null,
					LAYOUT_ATTRIBUTE_NOT_AN_ATTRIBUTE,
					usernameFrame.width,
				],
				[
					usernameWrapper,
					LAYOUT_ATTRIBUTE_HEIGHT,
					null,
					LAYOUT_ATTRIBUTE_NOT_AN_ATTRIBUTE,
					usernameFrame.height,
				],
			],
			layout,
		);
		let previousView = usernameWrapper;
		let previousFrame = usernameFrame;
		for (const { frame, view } of trailingViews) {
			const spacing = frame.x - previousFrame.x - previousFrame.width;
			await addLatencyConstraints(
				group,
				[
					[
						view,
						LAYOUT_ATTRIBUTE_LEADING,
						previousView,
						LAYOUT_ATTRIBUTE_TRAILING,
						spacing,
					],
					[
						view,
						LAYOUT_ATTRIBUTE_CENTER_Y,
						group,
						LAYOUT_ATTRIBUTE_CENTER_Y,
						frame.y + frame.height / 2 - groupFrame.height / 2,
					],
					[
						view,
						LAYOUT_ATTRIBUTE_WIDTH,
						null,
						LAYOUT_ATTRIBUTE_NOT_AN_ATTRIBUTE,
						frame.width,
					],
					[
						view,
						LAYOUT_ATTRIBUTE_HEIGHT,
						null,
						LAYOUT_ATTRIBUTE_NOT_AN_ATTRIBUTE,
						frame.height,
					],
				],
				layout,
			);
			previousView = view;
			previousFrame = frame;
		}
	} catch (error) {
		await restoreLatencyLayout(layout);
		await nativeCallAsync(icon, 'removeFromSuperview');
		throw error;
	}
	return layout;
}

function fillKey(fill: LatencyFill): string {
	return `${themeStore?.theme ?? 'darker'}:${fill.join(':')}`;
}

async function restoreLatencyView(state: LatencyViewState): Promise<void> {
	if (activeTooltipOwnerKey === state.cellKey) trackTooltipTask(dismissLatencyTooltip());
	latencyViews.delete(state.cellKey);
	await restoreLatencyLayout(state.layout);
	await nativeCallAsync(state.icon, 'removeFromSuperview');
}

async function createLatencyView(
	cellKey: string,
	messageId: string,
	record: LatencyRecord,
	username: NativeObjectHandle,
	header: NativeObjectHandle,
	isCurrent: () => boolean,
): Promise<LatencyViewState | null> {
	if (!objc || !isCurrent()) return null;
	const icon = await createLatencyIcon(record);
	const iconKey = icon ? nativeKey(icon) : null;
	if (!icon || !iconKey || !isCurrent()) return null;
	const layout = await installLatencyLayout(icon, username, header);
	if (!isCurrent()) {
		await restoreLatencyLayout(layout);
		await nativeCallAsync(icon, 'removeFromSuperview');
		return null;
	}
	const state: LatencyViewState = {
		cellKey,
		fillKey: fillKey(record.details.fill),
		icon,
		layout,
		messageId,
		tooltip: record.tooltip,
		username: record.username,
	};
	latencyViews.set(cellKey, state);
	await nativeCallAsync(header, 'setNeedsLayout');
	await nativeCallAsync(header, 'layoutIfNeeded');
	return state;
}

async function updateLatencyView(state: LatencyViewState, record: LatencyRecord): Promise<void> {
	if (!objc) return;
	if (state.fillKey !== fillKey(record.details.fill)) {
		const colors = await iconColors(record.details.fill);
		if (latencyViews.get(state.cellKey) !== state) return;
		const bars = nativeArray(await nativeCallAsync(state.icon, 'subviews'));
		for (let index = 0; index < bars.length && index < colors.length; index++) {
			const bar = bars[index];
			const color = colors[index];
			if (bar && color) await nativeCallAsync(bar, 'setBackgroundColor:', color);
		}
		state.fillKey = fillKey(record.details.fill);
	}
	if (state.tooltip !== record.tooltip) {
		await nativeCallAsync(
			state.icon,
			'setAccessibilityLabel:',
			record.details.displayDelta ?? 'Old Discord Android client',
		);
		await nativeCallAsync(state.icon, 'setAccessibilityHint:', record.tooltip);
		state.tooltip = record.tooltip;
	}
}

async function dismissLatencyTooltip(): Promise<void> {
	if (tooltipTimer) clearTimeout(tooltipTimer);
	tooltipTimer = null;
	tooltipGeneration++;
	tooltipDismissHook?.remove();
	tooltipDismissHook = null;
	const surface = activeTooltipSurface;
	const host = activeTooltip;
	const bridge = fabric;
	activeTooltipSurface = null;
	activeTooltip = null;
	activeTooltipOwnerKey = null;
	if (surface && bridge) await bridge.unmountAsync(surface).catch(() => undefined);
	if (host) await nativeCallAsync(host, 'removeFromSuperview');
}

function installTooltipDismissHook(generation: number): void {
	if (!objc || !activeTooltip || tooltipDismissHook || generation !== tooltipGeneration) return;
	try {
		tooltipDismissHook = objc.hook('UIWindow', 'sendEvent:', {
			after: () => {
				if (generation === tooltipGeneration) trackTooltipTask(dismissLatencyTooltip());
			},
		});
	} catch {
		return;
	}
}

function LatencyTooltipSurface({
	arrowDirection,
	arrowOffset,
	label,
	width,
}: LatencyTooltipProps): ReactNode {
	const tooltip = metro.findByProps('TooltipArrowDirections', 'TooltipArrowPositions') as
		| TooltipModule
		| undefined;
	if (!tooltip?.Tooltip) return null;
	const theme = metro.common.Theme as ThemeModule;
	const appearance = themeStore?.theme ?? theme.themes.DARK;
	const background = theme.internal.resolveSemanticColor(
		appearance,
		theme.colors.BACKGROUND_SURFACE_HIGHEST,
	);
	const foreground = theme.internal.resolveSemanticColor(appearance, theme.colors.TEXT_DEFAULT);
	return metro.common.React.createElement(tooltip.Tooltip, {
		arrowDirection,
		arrowOffset,
		arrowPosition: tooltip.TooltipArrowPositions.LEFT,
		arrowStyle: {
			borderBottomColor: background,
			borderTopColor: background,
		},
		containerStyle: { backgroundColor: background },
		label,
		labelStyle: { color: foreground },
		style: { width },
	});
}

function registerTooltipSurface(): boolean {
	if (tooltipSurfaceModuleName) return true;
	const registry = metro.common.ReactNative.AppRegistry;
	if (typeof registry?.registerComponent !== 'function') return false;
	const moduleName = `MessageLatencyTooltipSurface${Date.now()}`;
	try {
		registry.registerComponent(moduleName, () => LatencyTooltipSurface);
		tooltipSurfaceModuleName = moduleName;
		return true;
	} catch {
		return false;
	}
}

async function showLatencyTooltip(state: LatencyViewState): Promise<void> {
	if (!objc || !fabric || !registerTooltipSurface()) return;
	const token = lifecycle;
	await dismissLatencyTooltip();
	const generation = tooltipGeneration;
	if (!started || token !== lifecycle || !objc || !fabric) return;
	const window = (await nativeCallAsync(state.icon, 'window')) as NativeObjectHandle | null;
	const windowFrame = window ? frameFromRect(await nativeCallAsync(window, 'bounds')) : null;
	if (!window || !windowFrame) return;
	let host: NativeObjectHandle | null = null;
	let surface: NativeFabricSurface | null = null;
	try {
		const label = objc.alloc('UILabel');
		await nativeCallAsync(label, 'setText:', state.tooltip);
		await nativeCallAsync(label, 'setNumberOfLines:', 0);
		const fonts = objc.getClass('UIFont');
		if (!fonts) return;
		const font = (await nativeCallAsync(
			fonts,
			'systemFontOfSize:',
			13,
		)) as NativeObjectHandle | null;
		if (!font) return;
		await nativeCallAsync(label, 'setFont:', font);
		const maximumWidth = Math.max(120, Math.min(TOOLTIP_MAX_WIDTH, windowFrame.width - 32));
		const measured = (await nativeCallAsync(
			label,
			'sizeThatFits:',
			objc.struct('CGSize', { width: maximumWidth - 20, height: 1000 }),
		)) as { value?: unknown } | null;
		const measuredSize = (measured?.value ?? measured) as Record<string, unknown> | null;
		const textWidth = Math.min(maximumWidth - 20, Number(measuredSize?.width));
		const textHeight = Number(measuredSize?.height);
		if (![textWidth, textHeight].every(Number.isFinite) || textWidth <= 0 || textHeight <= 0)
			return;
		const bubbleWidth = textWidth + 28;
		const bubbleHeight = textHeight + 20 + TOOLTIP_ARROW_HEIGHT;
		const iconRect = objc.struct('CGRect', {
			origin: { x: 0, y: 4 },
			size: { width: LATENCY_ICON_WIDTH, height: LATENCY_ICON_HEIGHT },
		});
		const iconFrame = frameFromRect(
			await nativeCallAsync(state.icon, 'convertRect:toView:', iconRect, window),
		);
		if (!iconFrame) return;
		const x = Math.max(
			8,
			Math.min(
				iconFrame.x + (iconFrame.width - bubbleWidth) / 2,
				windowFrame.width - bubbleWidth - 8,
			),
		);
		const belowY = iconFrame.y + iconFrame.height + TOOLTIP_ANCHOR_GAP;
		const below = belowY + bubbleHeight <= windowFrame.height - 8;
		const y = below ? belowY : Math.max(8, iconFrame.y - bubbleHeight - TOOLTIP_ANCHOR_GAP);
		host = objc.alloc('UIView');
		await nativeCallAsync(host, 'setUserInteractionEnabled:', false);
		await nativeCallAsync(host, 'setAccessibilityIdentifier:', 'message-latency-tooltip');
		await setNativeFrameAsync(host, { height: bubbleHeight, width: bubbleWidth, x, y });
		if (
			generation !== tooltipGeneration ||
			token !== lifecycle ||
			!started ||
			latencyViews.get(state.cellKey) !== state
		)
			return;
		await nativeCallAsync(window, 'addSubview:', host);
		if (
			generation !== tooltipGeneration ||
			token !== lifecycle ||
			!started ||
			latencyViews.get(state.cellKey) !== state
		)
			return;
		const bridge = fabric;
		if (!bridge) return;
		surface = await bridge.mountAsync(host, tooltipSurfaceModuleName, {
			arrowDirection: below ? 'UP' : 'DOWN',
			arrowOffset: iconFrame.x + iconFrame.width / 2 - x - 8,
			label: state.tooltip,
			width: bubbleWidth,
		});
		await bridge.setSizeAsync(
			surface,
			{ width: bubbleWidth, height: bubbleHeight },
			{ width: bubbleWidth, height: bubbleHeight },
		);
		await bridge.setFrameAsync(surface, {
			x: 0,
			y: 0,
			width: bubbleWidth,
			height: bubbleHeight,
		});
		if (
			generation !== tooltipGeneration ||
			token !== lifecycle ||
			!started ||
			latencyViews.get(state.cellKey) !== state
		)
			return;
		activeTooltip = host;
		activeTooltipSurface = surface;
		activeTooltipOwnerKey = state.cellKey;
		host = null;
		surface = null;
		setTimeout(() => installTooltipDismissHook(generation), 0);
		tooltipTimer = setTimeout(() => {
			if (generation !== tooltipGeneration) return;
			trackTooltipTask(dismissLatencyTooltip());
		}, 3000);
	} catch {
		if (generation === tooltipGeneration) await dismissLatencyTooltip();
	} finally {
		if (surface && fabric) await fabric.unmountAsync(surface).catch(() => undefined);
		if (host) await nativeCallAsync(host, 'removeFromSuperview');
	}
}

async function renderCell(
	cell: NativeObjectHandle,
	key: string,
	token: number,
	revision: number,
): Promise<void> {
	if (!objc) return;
	const nodes = await objc.snapshot(cell, {
		maxDepth: MAX_CELL_DEPTH,
		maxNodes: MAX_CELL_NODES,
	});
	if (token !== lifecycle || cellRevisions.get(key) !== revision || !objc) return;
	if (!nodes[0]?.visible) {
		disposeCell(cell);
		return;
	}
	activeCells.set(key, cell);
	const messageId = await cellMessageId(cell);
	if (token !== lifecycle || cellRevisions.get(key) !== revision || !objc) return;
	await queueCellMutation(key, async () => {
		if (token !== lifecycle || cellRevisions.get(key) !== revision || !objc) return;
		const previousMessageId = activeCellMessageIds.get(key);
		if (previousMessageId && previousMessageId !== messageId) {
			cellsByMessageId.delete(previousMessageId);
			activeCellMessageIds.delete(key);
		}
		if (!messageId) return;
		activeCellMessageIds.set(key, messageId);
		cellsByMessageId.set(messageId, cell);
		const existing = latencyViews.get(key);
		if (existing && existing.messageId !== messageId) await restoreLatencyView(existing);
		if (token !== lifecycle || cellRevisions.get(key) !== revision || !objc) return;
		const record = latencyRecords.get(messageId);
		if (!record) {
			const current = latencyViews.get(key);
			if (current) await restoreLatencyView(current);
			return;
		}
		const current = latencyViews.get(key);
		if (current) {
			await updateLatencyView(current, record);
			return;
		}
		const labelIndex = labelForUsername(nodes, record.username);
		const label = nodes[labelIndex]?.view;
		if (!label) return;
		const header = headerForUsername(nodes, labelIndex);
		if (!header) return;
		await createLatencyView(
			key,
			messageId,
			record,
			label,
			header,
			() => token === lifecycle && cellRevisions.get(key) === revision && Boolean(objc),
		);
	});
}

function queueCellMutation(key: string, work: () => Promise<void>): Promise<void> {
	const previous = cellQueues.get(key) ?? Promise.resolve();
	const task = previous
		.catch(() => undefined)
		.then(work)
		.catch(() => undefined)
		.finally(() => {
			cellTasks.delete(task);
			if (cellQueues.get(key) === task) cellQueues.delete(key);
		});
	cellQueues.set(key, task);
	cellTasks.add(task);
	return task;
}

function scheduleCell(cell: NativeObjectHandle): void {
	if (!objc) return;
	const key = nativeKey(cell);
	if (!key || pendingCells.has(key)) return;
	pendingCells.add(key);
	const token = lifecycle;
	const revision = ++nextCellRevision;
	cellRevisions.set(key, revision);
	setTimeout(() => {
		if (token !== lifecycle || cellRevisions.get(key) !== revision || !objc) {
			pendingCells.delete(key);
			return;
		}
		void renderCell(cell, key, token, revision)
			.catch(() => {
				if (token === lifecycle && cellRevisions.get(key) === revision) disposeCell(cell);
			})
			.finally(() => {
				if (cellRevisions.get(key) === revision) pendingCells.delete(key);
			});
	}, 0);
}

function disposeCell(cell: NativeObjectHandle): void {
	const key = nativeKey(cell);
	if (!key) return;
	const state = latencyViews.get(key);
	if (state) {
		latencyViews.delete(key);
		void queueCellMutation(key, () => restoreLatencyView(state));
	}
	activeCells.delete(key);
	const messageId = activeCellMessageIds.get(key);
	if (messageId && cellsByMessageId.get(messageId) === cell) cellsByMessageId.delete(messageId);
	activeCellMessageIds.delete(key);
	pendingCells.delete(key);
	cellRevisions.delete(key);
}

function installNativeHooks(): void {
	if (!objc || cellHooks.length > 0) return;
	const installed: NativeHookToken[] = [];
	try {
		installed.push(
			objc.hook('UIControl', 'endTrackingWithTouch:withEvent:', {
				after: ({ self }) => {
					const key = nativeKey(self);
					if (!key) return;
					for (const state of latencyViews.values()) {
						if (nativeKey(state.icon) !== key) continue;
						trackTooltipTask(showLatencyTooltip(state));
						return;
					}
				},
			}),
		);
		installed.push(
			objc.hook('DCDMessageTableViewCell', 'didMoveToWindow', {
				after: ({ self }) => {
					scheduleCell(self);
				},
			}),
		);
		installed.push(
			objc.hook('DCDMessageTableViewCell', 'prepareForReuse', {
				after: ({ self }) => {
					disposeCell(self);
					scheduleCell(self);
				},
			}),
		);
		cellHooks = installed;
	} catch {
		for (const hook of installed) hook.remove();
	}
}

function cacheLatency(
	messageRow: MessageRowData | undefined,
	message: LatencyMessage | undefined,
	fallbackUsername: string = '',
): void {
	if (!message || message.id == null) return;
	if (message.nonce == null) return;
	const messageId = String(message.id);
	const details = latencyDetails(message, users?.getCurrentUser?.()?.id, currentOptions());
	if (!details) {
		if (latencyRecords.delete(messageId)) {
			const cell = cellsByMessageId.get(messageId);
			if (cell) scheduleCell(cell);
		}
		return;
	}
	const username =
		(typeof messageRow?.username === 'string' && messageRow.username) ||
		fallbackUsername ||
		message.author?.username ||
		latencyRecords.get(messageId)?.username ||
		'';
	if (!username) return;
	latencyRecords.delete(messageId);
	latencyRecords.set(messageId, {
		details,
		messageId,
		tooltip: latencyTooltip(details),
		username,
	});
	while (latencyRecords.size > MAX_LATENCY_RECORDS) {
		const oldest = latencyRecords.keys().next().value;
		if (!oldest) break;
		latencyRecords.delete(oldest);
	}
	const cell = cellsByMessageId.get(messageId);
	if (cell) scheduleCell(cell);
}

function onMessageCreate(event: Record<string, unknown>): void {
	const message = messageFromCreateEvent(event);
	if (!message) return;
	cacheLatency(undefined, message, message.author?.username);
}

function subscribeToMessageCreate(): void {
	if (removeMessageCreateListener) return;
	const dispatcher = metro.findByProps('dispatch', 'subscribe') as Dispatcher | null;
	if (!dispatcher?.subscribe || !dispatcher.unsubscribe) return;
	dispatcher.subscribe('MESSAGE_CREATE', onMessageCreate);
	removeMessageCreateListener = () => dispatcher.unsubscribe?.('MESSAGE_CREATE', onMessageCreate);
}

function initialize(): boolean {
	if (!started) return false;
	users = metro.findByProps('getCurrentUser');
	subscribeToMessageCreate();
	installNativeHooks();
	if (rowUnpatch) return true;
	const target = metro.findByProps('generateMessageRowData');
	if (typeof target?.generateMessageRowData !== 'function') return false;
	themeStore = metro.find((module) => {
		const theme = module?.theme;
		return (
			typeof theme === 'string' &&
			Object.values((metro.common.Theme as ThemeModule).themes).includes(theme)
		);
	});
	if (!removeThemeListener && themeStore?.addChangeListener && themeStore.removeChangeListener) {
		const onThemeChange = () => {
			for (const state of latencyViews.values()) {
				const record = latencyRecords.get(state.messageId);
				if (record)
					void queueCellMutation(state.cellKey, () => updateLatencyView(state, record));
			}
		};
		themeStore.addChangeListener(onThemeChange);
		removeThemeListener = () => themeStore?.removeChangeListener?.(onThemeChange);
	}
	rowUnpatch = patcher.after(target, 'generateMessageRowData', (context: RowPatchContext) => {
		try {
			cacheLatency(context.result?.message, context.args[0]?.message);
		} catch {
			return;
		}
	});
	return true;
}

function waitForMessageRows(): void {
	if (initialize()) return;
	removeModuleListener = metro.addListener(() => {
		if (!initialize()) return;
		removeModuleListener?.();
		removeModuleListener = null;
	});
}

function MessageLatencySettings() {
	const state = STORE.useSettingsStore();
	const latency = state.get('latency', 2);
	const thresholdIndex = LATENCY_OPTIONS.indexOf(latency);
	const nextThreshold = LATENCY_OPTIONS[(thresholdIndex + 1) % LATENCY_OPTIONS.length];

	return (
		<SettingsScrollView>
			<SettingsSection title='Indicator'>
				<SettingsRow
					label='Latency threshold'
					description='Show an indicator when a message takes at least this long to send.'
					trailing={`${latency}s`}
					onPress={() => state.set('latency', nextThreshold)}
				/>
				<SettingsSwitchRow
					label='Show milliseconds'
					description='Include millisecond precision in the indicator.'
					value={state.get('showMillis', false)}
					onValueChange={(value: boolean) => state.set('showMillis', value)}
				/>
				<SettingsSwitchRow
					label='Ignore my messages'
					description='Only mark messages sent by other people.'
					value={state.get('ignoreSelf', false)}
					onValueChange={(value: boolean) => state.set('ignoreSelf', value)}
				/>
				<SettingsSwitchRow
					label='Detect legacy Android clients'
					description='Show a marker for the known timestamp offset in older Discord Android clients.'
					value={state.get('detectDiscordKotlin', true)}
					onValueChange={(value: boolean) => state.set('detectDiscordKotlin', value)}
				/>
			</SettingsSection>
		</SettingsScrollView>
	);
}

async function cleanup(): Promise<void> {
	for (const hook of cellHooks) hook.remove();
	cellHooks = [];
	rowUnpatch?.();
	rowUnpatch = null;
	removeModuleListener?.();
	removeModuleListener = null;
	removeMessageCreateListener?.();
	removeMessageCreateListener = null;
	removeThemeListener?.();
	removeThemeListener = null;
	await dismissLatencyTooltip();
	await Promise.all([...tooltipTasks]);
	await Promise.all([...cellTasks]);
	await Promise.all([...latencyViews.values()].map(restoreLatencyView));
	for (const cell of activeCells.values()) pendingCells.delete(nativeKey(cell) ?? '');
	activeCells.clear();
	activeCellMessageIds.clear();
	cellsByMessageId.clear();
	pendingCells.clear();
	cellRevisions.clear();
	cellQueues.clear();
	cellTasks.clear();
	latencyRecords.clear();
	users = null;
	themeStore = null;
	started = false;
	objc = null;
	fabric = null;
}

export default {
	start(context?: PluginContext) {
		if (started) return;
		started = true;
		lifecycle++;
		objc = context?.native.objc ?? null;
		fabric = context?.native.fabric ?? null;
		waitForMessageRows();
	},
	stop(): Promise<void> {
		if (!started) return cleanupTask ?? Promise.resolve();
		started = false;
		lifecycle++;
		cleanupTask = cleanup().finally(() => {
			cleanupTask = null;
		});
		return cleanupTask;
	},
	getSettingsPanel: () => <MessageLatencySettings />,
};
