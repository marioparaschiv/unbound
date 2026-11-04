import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';
import type { TSchema } from '@unbound-app/contracts/schema';

import { OPERATION_TAGS, type PublicOperation } from '~/lib/api/openapi/public-operations';
import type { Endpoint } from '~/lib/api/endpoint';

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

/** The JSON Schema keywords the contract schemas use, as TypeBox writes them. */
export type JsonSchema = {
	type?: string | string[];
	properties?: Record<string, JsonSchema>;
	required?: string[];
	items?: JsonSchema;
	anyOf?: JsonSchema[];
	enum?: JsonValue[];
	const?: JsonValue;
	additionalProperties?: boolean | JsonSchema;
	patternProperties?: Record<string, JsonSchema>;
	pattern?: string;
	format?: string;
	minLength?: number;
	maxLength?: number;
	minItems?: number;
	maxItems?: number;
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number;
	exclusiveMaximum?: number;
	default?: JsonValue;
	description?: string;
	$ref?: string;
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type OpenApiParameter = {
	name: string;
	in: 'path' | 'query';
	required: boolean;
	description?: string;
	schema: JsonSchema;
};

export type OpenApiMedia = {
	content: { 'application/json': { schema: JsonSchema } };
};

export type OpenApiResponse = OpenApiMedia & { description: string };

export type OpenApiOperation = {
	operationId: string;
	tags: string[];
	summary: string;
	description: string;
	parameters?: OpenApiParameter[];
	requestBody?: OpenApiMedia & { required: true };
	responses: { '200': OpenApiResponse; '4XX': { $ref: string }; '5XX': { $ref: string } };
};

export type OpenApiDocument = {
	openapi: '3.1.0';
	info: { title: string; version: string; description: string };
	servers: { url: string }[];
	/** Empty: no operation here takes credentials. */
	security: [];
	tags: { name: string; description: string }[];
	paths: Record<string, Partial<Record<Lowercase<HttpMethod>, OpenApiOperation>>>;
	components: {
		schemas: { ApiError: JsonSchema };
		responses: { Error: OpenApiResponse };
	};
};

/** One route method to document: where it is served, its contract, and how the docs describe it. */
export type DocumentedOperation = {
	method: HttpMethod;
	/** The route's full path, with `$name` segments, such as `/api/v1/addons/$id/versions`. */
	path: string;
	endpoint: Endpoint<TSchema, TSchema, TSchema>;
	operation: PublicOperation;
};

export type OpenApiOptions = {
	/** The origin the paths are served from, such as `https://unbound.rip`. */
	serverUrl: string;
	version: string;
};

const ERROR_RESPONSE = '#/components/responses/Error';

const METHOD_KEYS: Record<HttpMethod, Lowercase<HttpMethod>> = {
	GET: 'get',
	POST: 'post',
	PUT: 'put',
	PATCH: 'patch',
	DELETE: 'delete',
};

// UNKNOWN: a node of a TypeBox schema, copied keyword by keyword.
function toJsonValue(value: unknown): JsonValue | undefined {
	if (value instanceof RegExp) {
		return value.source;
	}

	if (Array.isArray(value)) {
		return value.flatMap((item) => {
			const copy = toJsonValue(item);

			return copy === undefined ? [] : [copy];
		});
	}

	if (typeof value === 'object' && value !== null) {
		// `Type.Undefined()` stands for an absent body or query, which JSON Schema cannot express.
		if ('type' in value && value.type === 'undefined') return;

		const copy: Record<string, JsonValue> = {};

		// TypeBox keeps its own `~` keys and refinements non-enumerable, so only keywords remain.
		for (const [key, item] of Object.entries(value)) {
			const keyword = key === 'errorMessage' ? undefined : toJsonValue(item);

			if (keyword !== undefined) {
				copy[key] = keyword;
			}
		}

		return copy;
	}

	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
		? value
		: undefined;
}

/**
 * @description Copies a TypeBox schema as plain JSON Schema: patterns as their source, without the
 * custom `errorMessage`, and `Type.Undefined()` as absent.
 * @param schema The contract schema.
 * @returns The JSON Schema, or `undefined` for `Type.Undefined()`.
 */
export function toJsonSchema(schema: TSchema): JsonSchema | undefined {
	const copy = toJsonValue(schema);

	// A TypeBox schema is a JSON Schema object, so its keyword copy has JsonSchema's shape.
	return typeof copy === 'object' && copy !== null && !Array.isArray(copy) ? copy : undefined;
}

/** A route path as OpenAPI templates it, with its parameter names in order. */
export type OpenApiPath = {
	path: string;
	names: string[];
};

/**
 * @description Converts a route path's `$name` segments to OpenAPI's `{name}` templates.
 * @param path The route's full path.
 * @returns The templated path and its parameter names, in order.
 */
export function toOpenApiPath(path: string): OpenApiPath {
	const names: string[] = [];
	const templated = path.replaceAll(/\$(\w+)/g, (_, name: string) => {
		names.push(name);

		return `{${name}}`;
	});

	return { path: templated, names };
}

// `GET /api/v1/addons/$id/versions` becomes `getAddonsByIdVersions`.
function toOperationId(method: HttpMethod, path: string): string {
	const words = path
		.replace(/^\/api\/v1\//, '')
		.split('/')
		.flatMap((segment) =>
			segment.startsWith('$') ? ['by', segment.slice(1)] : segment.split('-'),
		);

	return [
		METHOD_KEYS[method],
		...words.map((word) => word[0]?.toUpperCase() + word.slice(1)),
	].join('');
}

function toJsonMedia(schema: JsonSchema): OpenApiMedia {
	return { content: { 'application/json': { schema } } };
}

function toQueryParameters(
	schema: JsonSchema | undefined,
	descriptions: PublicOperation['parameters'] = {},
): OpenApiParameter[] {
	const required = new Set(schema?.required);

	return Object.entries(schema?.properties ?? {}).map(([name, property]) => ({
		name,
		in: 'query',
		required: required.has(name),
		description: descriptions[name],
		schema: property,
	}));
}

function toOperation({ method, path, endpoint, operation }: DocumentedOperation): OpenApiOperation {
	const { names } = toOpenApiPath(path);
	const body = toJsonSchema(endpoint.schemas.body);
	const parameters: OpenApiParameter[] = [
		...names.map((name) => ({
			name,
			in: 'path' as const,
			required: true,
			description: operation.parameters?.[name],
			schema: { type: 'string' },
		})),
		...toQueryParameters(toJsonSchema(endpoint.schemas.query), operation.parameters),
	];

	return {
		operationId: toOperationId(method, path),
		tags: [operation.tag],
		summary: operation.summary,
		description: operation.description,
		...(parameters.length ? { parameters } : {}),
		...(body ? { requestBody: { required: true, ...toJsonMedia(body) } } : {}),
		responses: {
			'200': {
				description: 'OK',
				...toJsonMedia(toJsonSchema(endpoint.schemas.response) ?? {}),
			},
			'4XX': { $ref: ERROR_RESPONSE },
			'5XX': { $ref: ERROR_RESPONSE },
		},
	};
}

/**
 * @description Builds the OpenAPI 3.1 document of the given operations, grouped in tag order, with the
 * shared `{ error: { code, message } }` failure response.
 * @param operations The operations to document.
 * @param options The server origin and the document's version.
 * @returns The document.
 */
export function buildOpenApiDocument(
	operations: DocumentedOperation[],
	{ serverUrl, version }: OpenApiOptions,
): OpenApiDocument {
	const order: readonly string[] = OPERATION_TAGS.map((tag) => tag.name);
	const sorted = operations.toSorted(
		(a, b) => order.indexOf(a.operation.tag) - order.indexOf(b.operation.tag),
	);
	const paths: OpenApiDocument['paths'] = {};

	for (const entry of sorted) {
		const methods = (paths[toOpenApiPath(entry.path).path] ??= {});

		methods[METHOD_KEYS[entry.method]] = toOperation(entry);
	}

	return {
		openapi: '3.1.0',
		info: {
			title: 'Unbound API',
			version,
			description:
				'The public Unbound HTTP API. Every operation here answers JSON without signing in. A failure answers a non-2xx status with `{ error: { code, message } }`.',
		},
		servers: [{ url: serverUrl }],
		security: [],
		tags: OPERATION_TAGS.map((tag) => ({ ...tag })),
		paths,
		components: {
			schemas: { ApiError: toJsonSchema(apiErrorResponseSchema) ?? {} },
			responses: {
				Error: {
					description:
						'The request failed. `code` names why; `message` explains it to a person.',
					...toJsonMedia({ $ref: '#/components/schemas/ApiError' }),
				},
			},
		},
	};
}

export default { toJsonSchema, toOpenApiPath, buildOpenApiDocument };
