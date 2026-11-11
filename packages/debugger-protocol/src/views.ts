/**
 * The view finder's frames: a controller asks the device for one level of its native view tree at a
 * time, and names the view the device should outline on screen.
 */

/** A rectangle in screen coordinates, in dp on Android and points on iOS. */
export type ViewFrame = {
	x: number;
	y: number;
	width: number;
	height: number;
};

/** One native view, with only its top-level properties. */
export type ViewNode = {
	/** The device's id for the view, valid until the next request for the roots. */
	id: string;
	/** The fully qualified Java class name, or the Objective-C class name. */
	className: string;
	/** The Android resource entry name of the view's id, or the iOS accessibility identifier. */
	resourceName: string | null;
	frame: ViewFrame;
	visibility: 'visible' | 'invisible' | 'gone';
	/** The view's opacity from 0 to 1, or `null` when the platform did not report it. */
	alpha: number | null;
	/** The text a text view shows, cut to a few hundred characters. */
	text: string | null;
	/** How many direct children the view has. */
	childCount: number;
};

/** Controller → bridge → device: list the children of `parent`, or the root views when it is omitted. */
export type ViewsRequest = {
	type: 'views-request';
	/** Correlation id echoed back on the matching {@link ViewsResult}. */
	id: string;
	parent?: string;
};

/** The answer to a {@link ViewsRequest}, sent device → bridge → the controller that asked. */
export type ViewsResult = {
	type: 'views-result';
	/** The `id` of the {@link ViewsRequest} this answers. */
	id: string;
} & ({ ok: true; nodes: ViewNode[] } | { ok: false; error: string });

/** Controller → bridge → device: outline the view with this id on screen, or clear the outline when `null`. */
export type ViewHighlight = {
	type: 'view-highlight';
	node: string | null;
};

const VISIBILITIES: ReadonlySet<unknown> = new Set(['visible', 'invisible', 'gone']);

function isObject(value: unknown): value is object {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
	return value === null || typeof value === 'string';
}

function isViewFrame(value: unknown): value is ViewFrame {
	return (
		isObject(value) &&
		'x' in value &&
		typeof value.x === 'number' &&
		'y' in value &&
		typeof value.y === 'number' &&
		'width' in value &&
		typeof value.width === 'number' &&
		'height' in value &&
		typeof value.height === 'number'
	);
}

/**
 * @description Checks that a value has every field a {@link ViewNode} needs.
 * @param value The parsed value.
 * @returns Whether it is a view node.
 */
export function isViewNode(value: unknown): value is ViewNode {
	return (
		isObject(value) &&
		'id' in value &&
		typeof value.id === 'string' &&
		'className' in value &&
		typeof value.className === 'string' &&
		'resourceName' in value &&
		isNullableString(value.resourceName) &&
		'frame' in value &&
		isViewFrame(value.frame) &&
		'visibility' in value &&
		VISIBILITIES.has(value.visibility) &&
		'alpha' in value &&
		(value.alpha === null || typeof value.alpha === 'number') &&
		'text' in value &&
		isNullableString(value.text) &&
		'childCount' in value &&
		typeof value.childCount === 'number'
	);
}

/**
 * @description Checks the fields of a view finder frame whose `type` is already known.
 * @param frame The parsed frame.
 * @returns Whether the frame is a valid view request, result or highlight.
 */
export function isViewFrameMessage(
	frame: unknown,
): frame is ViewsRequest | ViewsResult | ViewHighlight {
	if (!isObject(frame) || !('type' in frame)) {
		return false;
	}

	switch (frame.type) {
		case 'views-request':
			return (
				'id' in frame &&
				typeof frame.id === 'string' &&
				(!('parent' in frame) ||
					frame.parent === undefined ||
					typeof frame.parent === 'string')
			);
		case 'views-result':
			return (
				'id' in frame &&
				typeof frame.id === 'string' &&
				'ok' in frame &&
				(frame.ok === true
					? 'nodes' in frame &&
						Array.isArray(frame.nodes) &&
						frame.nodes.every(isViewNode)
					: frame.ok === false && 'error' in frame && typeof frame.error === 'string')
			);
		case 'view-highlight':
			return 'node' in frame && isNullableString(frame.node);
		default:
			return false;
	}
}
