import type {
	HttpMethod,
	JsonSchema,
	JsonValue,
	OpenApiDocument,
	OpenApiOperation,
	OpenApiParameter,
} from '~/lib/api/openapi/openapi-document';

/** One operation of the HTTP reference, as its section on the page shows it. */
export type HttpOperationEntry = {
	method: HttpMethod;
	/** The templated path, such as `/api/v1/addons/{id}/versions`. */
	path: string;
	/** The section's id on the page; the operation's `operationId`. */
	anchor: string;
	operation: OpenApiOperation;
};

/** A sidebar group of the HTTP reference: one tag and its operations. */
export type HttpTagGroup = {
	name: string;
	description: string;
	operations: HttpOperationEntry[];
};

/** One field of a request or response body, with the fields nested under it. */
export type SchemaField = {
	name: string;
	type: string;
	required: boolean;
	default?: string;
	description?: string;
	/** Limits worth reading, such as `≤ 512 characters` or `pattern ^[a-z]+$`. */
	constraints: string[];
	fields: SchemaField[];
};

const METHODS: Record<string, HttpMethod> = {
	get: 'GET',
	post: 'POST',
	put: 'PUT',
	patch: 'PATCH',
	delete: 'DELETE',
};

/**
 * @description Groups a document's operations by tag, in the document's tag order.
 * @param document The OpenAPI document.
 * @returns The groups that have operations.
 */
export function groupOperations(document: OpenApiDocument): HttpTagGroup[] {
	const entries = Object.entries(document.paths).flatMap(([path, methods]) =>
		Object.entries(methods).flatMap(([key, operation]) => {
			const method = METHODS[key];

			return method && operation
				? [{ method, path, anchor: operation.operationId, operation }]
				: [];
		}),
	);

	return document.tags.flatMap((tag) => {
		const operations = entries.filter((entry) => entry.operation.tags.includes(tag.name));

		return operations.length ? [{ ...tag, operations }] : [];
	});
}

// Members that are only `null` read as `| null` in the type, not as alternatives to describe.
function withoutNull(schemas: JsonSchema[]): JsonSchema[] {
	return schemas.filter((schema) => schema.type !== 'null');
}

function formatValue(value: JsonValue): string {
	return typeof value === 'string' ? `'${value}'` : JSON.stringify(value);
}

/**
 * @description Writes a schema's type the way the guides' fields do, such as `'ios' | 'android'`,
 * `string | null` or `object[]`.
 * @param schema The schema.
 * @returns The type as text.
 */
export function getTypeLabel(schema: JsonSchema): string {
	if (schema.$ref) {
		return schema.$ref.split('/').at(-1) ?? 'object';
	}

	if (schema.enum) {
		return schema.enum.map(formatValue).join(' | ');
	}

	if (schema.const !== undefined) {
		return formatValue(schema.const);
	}

	if (schema.anyOf) {
		return schema.anyOf.map(getTypeLabel).join(' | ');
	}

	if (schema.type === 'array') {
		const item = schema.items ? getTypeLabel(schema.items) : 'unknown';

		return item.includes(' | ') ? `(${item})[]` : `${item}[]`;
	}

	const values = schema.patternProperties
		? Object.values(schema.patternProperties)[0]
		: typeof schema.additionalProperties === 'object'
			? schema.additionalProperties
			: undefined;

	if (schema.type === 'object' && values) {
		return `Record<string, ${getTypeLabel(values)}>`;
	}

	return Array.isArray(schema.type) ? schema.type.join(' | ') : (schema.type ?? 'unknown');
}

function ownConstraints(schema: JsonSchema): string[] {
	const keys = schema.patternProperties ? Object.keys(schema.patternProperties) : [];

	return [
		schema.format && `format ${schema.format}`,
		schema.minLength !== undefined && `≥ ${schema.minLength} characters`,
		schema.maxLength !== undefined && `≤ ${schema.maxLength} characters`,
		schema.minItems !== undefined && `≥ ${schema.minItems} items`,
		schema.maxItems !== undefined && `≤ ${schema.maxItems} items`,
		schema.minimum !== undefined && `≥ ${schema.minimum}`,
		schema.exclusiveMinimum !== undefined && `> ${schema.exclusiveMinimum}`,
		schema.maximum !== undefined && `≤ ${schema.maximum}`,
		schema.exclusiveMaximum !== undefined && `< ${schema.exclusiveMaximum}`,
		schema.pattern && `pattern ${schema.pattern}`,
		...keys.map((key) => `keys match ${key}`),
	].filter((entry): entry is string => Boolean(entry));
}

/**
 * @description Lists the limits a value must meet, from the schema and the members of its union.
 * @param schema The schema.
 * @returns The limits as short phrases.
 */
export function getConstraints(schema: JsonSchema): string[] {
	const members = withoutNull(schema.anyOf ?? []);
	const items = schema.type === 'array' && schema.items ? ownConstraints(schema.items) : [];

	return [
		...new Set([
			...ownConstraints(schema),
			...members.flatMap(ownConstraints),
			...items.map((entry) => `each ${entry}`),
		]),
	];
}

// The object whose keys a field nests: itself, its array's items, or the one object of its union.
function nestedObject(schema: JsonSchema): JsonSchema | undefined {
	if (schema.properties) {
		return schema;
	}

	if (schema.type === 'array' && schema.items) {
		return nestedObject(schema.items);
	}

	const members = withoutNull(schema.anyOf ?? []);

	return members.length === 1 && members[0] ? nestedObject(members[0]) : undefined;
}

/**
 * @description Lists an object schema's keys as fields, each with the fields of the object it holds.
 * @param schema The object, an array of objects, or a union with one object member.
 * @returns The fields, in declaration order; none for a schema without keys.
 */
export function getSchemaFields(schema: JsonSchema): SchemaField[] {
	const object = nestedObject(schema);
	const required = new Set(object?.required);

	return Object.entries(object?.properties ?? {}).map(([name, property]) => ({
		name,
		type: getTypeLabel(property),
		required: required.has(name),
		default: property.default === undefined ? undefined : formatValue(property.default),
		description: property.description,
		constraints: getConstraints(property),
		fields: getSchemaFields(property),
	}));
}

/**
 * @description Describes a path or query parameter as a field.
 * @param parameter The parameter.
 * @returns The field, without nested fields.
 */
export function getParameterField(parameter: OpenApiParameter): SchemaField {
	return {
		name: parameter.name,
		type: getTypeLabel(parameter.schema),
		required: parameter.required,
		description: parameter.description,
		constraints: getConstraints(parameter.schema),
		fields: [],
	};
}

export default {
	groupOperations,
	getTypeLabel,
	getConstraints,
	getSchemaFields,
	getParameterField,
};
