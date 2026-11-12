/**
 * The object explorer's frames: a controller asks the device for a native object's class chain, one page of one kind
 * of a class's members, the values of the members on screen, and (iOS) the loaded images and their classes.
 */

/** The most members a device returns for one {@link ExplorerMembersRequest}. */
export const EXPLORER_MEMBERS_PAGE_SIZE = 100;
/** The most images or class names a device returns for one {@link ExplorerClassesRequest}. */
export const EXPLORER_CLASSES_PAGE_SIZE = 200;
/** The most member values one {@link ExplorerValuesRequest} may name. */
export const EXPLORER_VALUES_LIMIT = 50;

/** A kind of class member: the first five are Objective-C's, `fields` to `interfaces` Java's, `methods` both. */
export type ExplorerMemberKind =
	| 'properties'
	| 'ivars'
	| 'methods'
	| 'classMethods'
	| 'protocols'
	| 'fields'
	| 'constructors'
	| 'interfaces';

/** What to explore: a listed view, an object the explorer handed out a ref for, or a class by name. */
export type ExplorerTarget = { node: string } | { object: string } | { className: string };

/** One class of an object's chain, with how many members of each kind it declares itself. */
export type ExplorerClass = {
	name: string;
	/** The binary image that defines the class, or `null` when unknown, as on Android. */
	image: string | null;
	/** The size of an instance in bytes, or `null` when unknown. */
	instanceSize: number | null;
	counts: Partial<Record<ExplorerMemberKind, number>>;
};

/** One member a class declares. */
export type ExplorerMember = {
	name: string;
	kind: ExplorerMemberKind;
	/** The decoded type of a property, ivar or field, or a method's return type. */
	type: string | null;
	/** A declaration to show, such as `- (void)setFoo:(id)foo`. */
	signature: string | null;
	returnType?: string;
	parameters?: string[];
	/** Property attributes such as `nonatomic`, `strong` or `readonly`. */
	attributes?: string[];
	static?: boolean;
	offset?: number;
	size?: number;
	image?: string | null;
	/** Whether a value read is automatic and safe, runs code so needs a click, or is never made. */
	read: 'auto' | 'manual' | 'never';
};

/** How a member's value reads: a value kind, `skipped` when unsafe to read, or `error`. */
export type ExplorerValueKind =
	| 'nil'
	| 'number'
	| 'bool'
	| 'string'
	| 'object'
	| 'class'
	| 'struct'
	| 'pointer'
	| 'selector'
	| 'other'
	| 'skipped'
	| 'error';

/** One member's value, read on the device. */
export type ExplorerValue = {
	name: string;
	kind: ExplorerValueKind;
	text: string;
	/** The ref to open an object value with, as an `{ object }` target. */
	object?: string;
	className?: string;
};

/** A native object, or a class alone when `ref` is `null`. */
export type ExplorerObject = {
	/** The device's ref for the object, `<epoch>:<n>`, valid until the debugger reconnects or JavaScript reloads. */
	ref: string | null;
	className: string;
	description: string | null;
	platform: 'ios' | 'android';
	/** The class, then each superclass up to the root. */
	chain: ExplorerClass[];
};

/** Why an explorer request failed, so the controller can fall back or explain. */
export type ExplorerErrorCode =
	/** The ref or node is gone, such as after a JavaScript reload. */
	| 'stale'
	/** Developer mode and the debugger are both off. */
	| 'disabled'
	/** The inspector failed to load. */
	| 'unavailable'
	/** The loader or platform cannot answer this request. */
	| 'unsupported'
	| 'unknown-class'
	| 'failed';

/** A failed explorer answer. */
export type ExplorerError = {
	ok: false;
	error: string;
	code: ExplorerErrorCode;
};

/** A loaded binary image that defines Objective-C classes. */
export type ExplorerImage = { path: string; name: string; classCount: number };

/** Controller → bridge → device: read an object's class chain. */
export type ExplorerObjectRequest = {
	type: 'explorer-object-request';
	/** Correlation id echoed back on the matching {@link ExplorerObjectResult}. */
	id: string;
	target: ExplorerTarget;
};

/** The answer to an {@link ExplorerObjectRequest}. */
export type ExplorerObjectResult = {
	type: 'explorer-object-result';
	id: string;
} & ({ ok: true; object: ExplorerObject } | ExplorerError);

/** Controller → bridge → device: list one page of one kind of the members a class declares. */
export type ExplorerMembersRequest = {
	type: 'explorer-members-request';
	id: string;
	className: string;
	kind: ExplorerMemberKind;
	offset?: number;
	/** At most {@link EXPLORER_MEMBERS_PAGE_SIZE}, which is also the default. */
	limit?: number;
	/** A case-insensitive substring of the member names to keep. */
	filter?: string;
};

/** The answer to an {@link ExplorerMembersRequest}. */
export type ExplorerMembersResult = {
	type: 'explorer-members-result';
	id: string;
} & ({ ok: true; members: ExplorerMember[]; total: number } | ExplorerError);

/** Controller → bridge → device: read the named members of `className` on an object. */
export type ExplorerValuesRequest = {
	type: 'explorer-values-request';
	id: string;
	/** The object's ref. */
	object: string;
	className: string;
	kind: ExplorerMemberKind;
	/** At most {@link EXPLORER_VALUES_LIMIT} names. */
	names: string[];
	/** Runs the getters of computed properties too. */
	invokeGetters?: boolean;
};

/** The answer to an {@link ExplorerValuesRequest}. */
export type ExplorerValuesResult = {
	type: 'explorer-values-result';
	id: string;
} & ({ ok: true; values: ExplorerValue[] } | ExplorerError);

/** Controller → bridge → device: list a page of the loaded images, or of one image's class names. */
export type ExplorerClassesRequest = {
	type: 'explorer-classes-request';
	id: string;
	/** The image path whose classes to list; the images themselves when omitted. */
	image?: string;
	filter?: string;
	offset?: number;
	/** At most {@link EXPLORER_CLASSES_PAGE_SIZE}, which is also the default. */
	limit?: number;
};

/** The answer to an {@link ExplorerClassesRequest}: `images` without an image, `classes` with one. */
export type ExplorerClassesResult = {
	type: 'explorer-classes-result';
	id: string;
} & ({ ok: true; total: number; images?: ExplorerImage[]; classes?: string[] } | ExplorerError);

export type ExplorerRequest =
	| ExplorerObjectRequest
	| ExplorerMembersRequest
	| ExplorerValuesRequest
	| ExplorerClassesRequest;

export type ExplorerResult =
	| ExplorerObjectResult
	| ExplorerMembersResult
	| ExplorerValuesResult
	| ExplorerClassesResult;

/** The result frame type answering each request frame type. */
export const EXPLORER_RESULT_TYPES = {
	'explorer-object-request': 'explorer-object-result',
	'explorer-members-request': 'explorer-members-result',
	'explorer-values-request': 'explorer-values-result',
	'explorer-classes-request': 'explorer-classes-result',
} as const satisfies Record<ExplorerRequest['type'], ExplorerResult['type']>;

const MEMBER_KINDS: ReadonlySet<unknown> = new Set<ExplorerMemberKind>([
	'properties',
	'ivars',
	'methods',
	'classMethods',
	'protocols',
	'fields',
	'constructors',
	'interfaces',
]);
const VALUE_KINDS: ReadonlySet<unknown> = new Set<ExplorerValueKind>([
	'nil',
	'number',
	'bool',
	'string',
	'object',
	'class',
	'struct',
	'pointer',
	'selector',
	'other',
	'skipped',
	'error',
]);
const ERROR_CODES: ReadonlySet<unknown> = new Set<ExplorerErrorCode>([
	'stale',
	'disabled',
	'unavailable',
	'unsupported',
	'unknown-class',
	'failed',
]);
const READS: ReadonlySet<unknown> = new Set(['auto', 'manual', 'never']);

/** A frame narrowed to its type, before its other fields are checked. */
type TypedFrame = { type: string };

/** A value parsed off the wire, before it is checked. */
type WireValue = string | number | boolean | null | undefined | WireValue[] | WireRecord;

/** An object parsed off the wire, before its fields are checked. */
type WireRecord = { [key: string]: WireValue };

/**
 * @description Builds the failed answer to an explorer request.
 * @param request The request, or its type and id.
 * @param error What failed.
 * @param code Why it failed.
 * @returns The result frame.
 */
export function failExplorerRequest(
	request: Pick<ExplorerRequest, 'type' | 'id'>,
	error: string,
	code: ExplorerErrorCode,
): ExplorerResult {
	return { type: EXPLORER_RESULT_TYPES[request.type], id: request.id, ok: false, error, code };
}

/**
 * @description Checks whether a frame is an explorer request, by its type alone.
 * @param frame A parsed frame.
 * @returns Whether it is one.
 */
export function isExplorerRequest(frame: TypedFrame): frame is ExplorerRequest {
	return Object.hasOwn(EXPLORER_RESULT_TYPES, frame.type);
}

/**
 * @description Checks whether a frame is an explorer result, by its type alone.
 * @param frame A parsed frame.
 * @returns Whether it is one.
 */
export function isExplorerResult(frame: TypedFrame): frame is ExplorerResult {
	return Object.values<string>(EXPLORER_RESULT_TYPES).includes(frame.type);
}

function isObject(value: unknown): value is WireRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStrings(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isNullableString(value: unknown): value is string | null {
	return value === null || typeof value === 'string';
}

/** Checks an optional field: absent, `undefined`, or passing `check`. */
function optional(record: WireRecord, key: string, check: (value: WireValue) => boolean) {
	return record[key] === undefined || check(record[key]);
}

const isString = (value: WireValue): value is string => typeof value === 'string';
const isNumber = (value: WireValue): value is number =>
	typeof value === 'number' && Number.isFinite(value);

function isTarget(value: unknown): value is ExplorerTarget {
	if (!isObject(value)) {
		return false;
	}

	const keys = ['node', 'object', 'className'].filter((key) => value[key] !== undefined);

	return keys.length === 1 && typeof value[keys[0] ?? ''] === 'string';
}

function isExplorerClass(value: unknown): value is ExplorerClass {
	return (
		isObject(value) &&
		typeof value.name === 'string' &&
		isNullableString(value.image) &&
		(value.instanceSize === null || isCount(value.instanceSize)) &&
		isObject(value.counts) &&
		Object.entries(value.counts).every(
			([kind, count]) => MEMBER_KINDS.has(kind) && isCount(count),
		)
	);
}

function isExplorerMember(value: unknown): value is ExplorerMember {
	return (
		isObject(value) &&
		typeof value.name === 'string' &&
		MEMBER_KINDS.has(value.kind) &&
		isNullableString(value.type) &&
		isNullableString(value.signature) &&
		READS.has(value.read) &&
		optional(value, 'returnType', isString) &&
		optional(value, 'parameters', isStrings) &&
		optional(value, 'attributes', isStrings) &&
		optional(value, 'static', (flag) => typeof flag === 'boolean') &&
		optional(value, 'offset', isNumber) &&
		optional(value, 'size', isNumber) &&
		optional(value, 'image', isNullableString)
	);
}

function isExplorerValue(value: unknown): value is ExplorerValue {
	return (
		isObject(value) &&
		typeof value.name === 'string' &&
		VALUE_KINDS.has(value.kind) &&
		typeof value.text === 'string' &&
		optional(value, 'object', isString) &&
		optional(value, 'className', isString)
	);
}

function isExplorerObject(value: unknown): value is ExplorerObject {
	return (
		isObject(value) &&
		isNullableString(value.ref) &&
		typeof value.className === 'string' &&
		isNullableString(value.description) &&
		(value.platform === 'ios' || value.platform === 'android') &&
		Array.isArray(value.chain) &&
		value.chain.every(isExplorerClass)
	);
}

function isExplorerImage(value: unknown): value is ExplorerImage {
	return (
		isObject(value) &&
		typeof value.path === 'string' &&
		typeof value.name === 'string' &&
		isCount(value.classCount)
	);
}

function isPage(frame: WireRecord): boolean {
	return (
		optional(frame, 'offset', isCount) &&
		optional(frame, 'limit', isCount) &&
		optional(frame, 'filter', isString)
	);
}

/** Checks a result's id and outcome; `isOk` checks the payload of a successful one. */
function isResult(frame: WireRecord, isOk: () => boolean): boolean {
	if (typeof frame.id !== 'string') {
		return false;
	}

	if (frame.ok === true) {
		return isOk();
	}

	return frame.ok === false && typeof frame.error === 'string' && ERROR_CODES.has(frame.code);
}

/**
 * @description Checks the fields of an explorer frame whose `type` is already known.
 * @param frame The parsed frame.
 * @returns Whether the frame is a valid explorer request or result.
 */
export function isExplorerFrame(frame: unknown): frame is ExplorerRequest | ExplorerResult {
	if (!isObject(frame)) {
		return false;
	}

	switch (frame.type) {
		case 'explorer-object-request':
			return typeof frame.id === 'string' && isTarget(frame.target);
		case 'explorer-object-result':
			return isResult(frame, () => isExplorerObject(frame.object));
		case 'explorer-members-request':
			return (
				typeof frame.id === 'string' &&
				typeof frame.className === 'string' &&
				MEMBER_KINDS.has(frame.kind) &&
				isPage(frame)
			);
		case 'explorer-members-result':
			return isResult(
				frame,
				() =>
					isCount(frame.total) &&
					Array.isArray(frame.members) &&
					frame.members.every(isExplorerMember),
			);
		case 'explorer-values-request':
			return (
				typeof frame.id === 'string' &&
				typeof frame.object === 'string' &&
				typeof frame.className === 'string' &&
				MEMBER_KINDS.has(frame.kind) &&
				isStrings(frame.names) &&
				optional(frame, 'invokeGetters', (flag) => typeof flag === 'boolean')
			);
		case 'explorer-values-result':
			return isResult(
				frame,
				() => Array.isArray(frame.values) && frame.values.every(isExplorerValue),
			);
		case 'explorer-classes-request':
			return (
				typeof frame.id === 'string' && optional(frame, 'image', isString) && isPage(frame)
			);
		case 'explorer-classes-result':
			return isResult(
				frame,
				() =>
					isCount(frame.total) &&
					optional(
						frame,
						'images',
						(images) => Array.isArray(images) && images.every(isExplorerImage),
					) &&
					optional(frame, 'classes', isStrings),
			);
		default:
			return false;
	}
}
