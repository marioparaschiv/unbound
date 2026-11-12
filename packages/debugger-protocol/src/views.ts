/**
 * The view finder's frames: a controller asks the device for one page of one level of its native view
 * tree at a time, for one view's properties when it selects it, and names the view to outline on screen.
 */

/** The most views a device returns for one {@link ViewsRequest}; a longer level is read in pages. */
export const VIEWS_PAGE_SIZE = 100;

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

/**
 * Controller → bridge → device: list a page of the children of `parent`, or the root views when it is
 * omitted. Listing the roots renews every id.
 */
export type ViewsRequest = {
	type: 'views-request';
	/** Correlation id echoed back on the matching {@link ViewsResult}. */
	id: string;
	parent?: string;
	/** The index of the first child to list. Defaults to 0. */
	offset?: number;
	/** How many children to list, at most {@link VIEWS_PAGE_SIZE}, which is also the default. */
	limit?: number;
};

/** The answer to a {@link ViewsRequest}, sent device → bridge → the controller that asked. */
export type ViewsResult = {
	type: 'views-result';
	/** The `id` of the {@link ViewsRequest} this answers. */
	id: string;
} & (
	| {
			ok: true;
			nodes: ViewNode[];
			/** How many children the parent has in all; more pages follow while it exceeds `offset + nodes.length`. */
			total?: number;
	  }
	| { ok: false; error: string }
);

/** A property value: text, a number, a flag or nothing. A `color` is `#RRGGBBAA`. */
export type ViewPropertyValue = string | number | boolean | null;

/** One property of a native view, read when the controller selects it. */
export type ViewProperty = {
	key: string;
	value: ViewPropertyValue;
	/** Draws the value as a colour swatch when `color`. */
	kind?: 'color';
	/** The unit a number is in, such as `dp`, `pt` or `px`. */
	unit?: string;
};

/** A titled group of properties, such as Layout or Accessibility. */
export type ViewSection = {
	title: string;
	properties: ViewProperty[];
};

/** What a device reads about one view beyond its {@link ViewNode}, for patching it with the native bridge. */
export type ViewDetails = {
	/** The view's class, then each superclass up to the platform's root view class. */
	classChain: string[];
	sections: ViewSection[];
};

/** Controller → bridge → device: read the properties of the listed view `node`. */
export type ViewDetailsRequest = {
	type: 'view-details-request';
	/** Correlation id echoed back on the matching {@link ViewDetailsResult}. */
	id: string;
	node: string;
};

/** The answer to a {@link ViewDetailsRequest}, sent device → bridge → the controller that asked. */
export type ViewDetailsResult = {
	type: 'view-details-result';
	/** The `id` of the {@link ViewDetailsRequest} this answers. */
	id: string;
} & ({ ok: true; details: ViewDetails } | { ok: false; error: string });

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

function isOptionalCount(value: unknown): boolean {
	return (
		value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0)
	);
}

function isViewProperty(value: unknown): value is ViewProperty {
	return (
		isObject(value) &&
		'key' in value &&
		typeof value.key === 'string' &&
		'value' in value &&
		(isNullableString(value.value) ||
			typeof value.value === 'number' ||
			typeof value.value === 'boolean') &&
		(!('kind' in value) || value.kind === undefined || value.kind === 'color') &&
		(!('unit' in value) || value.unit === undefined || typeof value.unit === 'string')
	);
}

/**
 * @description Checks that a value has every field {@link ViewDetails} needs.
 * @param value The parsed value.
 * @returns Whether it is a view's details.
 */
export function isViewDetails(value: unknown): value is ViewDetails {
	return (
		isObject(value) &&
		'classChain' in value &&
		Array.isArray(value.classChain) &&
		value.classChain.every((name) => typeof name === 'string') &&
		'sections' in value &&
		Array.isArray(value.sections) &&
		value.sections.every(
			(section: unknown) =>
				isObject(section) &&
				'title' in section &&
				typeof section.title === 'string' &&
				'properties' in section &&
				Array.isArray(section.properties) &&
				section.properties.every(isViewProperty),
		)
	);
}

/**
 * @description Checks the fields of a view finder frame whose `type` is already known.
 * @param frame The parsed frame.
 * @returns Whether the frame is a valid view request, result, details frame or highlight.
 */
export function isViewFrameMessage(
	frame: unknown,
): frame is ViewsRequest | ViewsResult | ViewDetailsRequest | ViewDetailsResult | ViewHighlight {
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
					typeof frame.parent === 'string') &&
				isOptionalCount('offset' in frame ? frame.offset : undefined) &&
				isOptionalCount('limit' in frame ? frame.limit : undefined)
			);
		case 'views-result':
			return (
				'id' in frame &&
				typeof frame.id === 'string' &&
				'ok' in frame &&
				(frame.ok === true
					? 'nodes' in frame &&
						Array.isArray(frame.nodes) &&
						frame.nodes.every(isViewNode) &&
						isOptionalCount('total' in frame ? frame.total : undefined)
					: frame.ok === false && 'error' in frame && typeof frame.error === 'string')
			);
		case 'view-details-request':
			return (
				'id' in frame &&
				typeof frame.id === 'string' &&
				'node' in frame &&
				typeof frame.node === 'string'
			);
		case 'view-details-result':
			return (
				'id' in frame &&
				typeof frame.id === 'string' &&
				'ok' in frame &&
				(frame.ok === true
					? 'details' in frame && isViewDetails(frame.details)
					: frame.ok === false && 'error' in frame && typeof frame.error === 'string')
			);
		case 'view-highlight':
			return 'node' in frame && isNullableString(frame.node);
		default:
			return false;
	}
}
