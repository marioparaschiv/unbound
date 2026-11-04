import { updatesRequestSchema } from '@unbound-app/contracts/updates';
import { describe, expect, mock, test } from 'bun:test';
import type { AnyRoute } from '@tanstack/react-router';
import { Type } from '@unbound-app/contracts/schema';
import { join } from 'node:path';

import {
	buildOpenApiDocument,
	toJsonSchema,
	toOpenApiPath,
	type JsonSchema,
} from '~/lib/api/openapi/openapi-document';
import {
	collectServedEndpoints,
	listPublicOperations,
	toRoutePath,
} from '~/lib/api/openapi/served-operations';
import { getCurlExample, getSchemaFields, groupOperations } from '~/lib/docs/http-reference';
import { PUBLIC_OPERATIONS } from '~/lib/api/openapi/public-operations';

// `serve` binds handlers to the process-wide app, which reads the deployment's env; no handler runs here.
void mock.module('~/lib/app', () => ({ default: {} }));

const ROUTES = join(import.meta.dir, '../src/routes/api/v1');

// The same files the server globs, loaded as bun loads them.
async function loadApiRoutes(): Promise<Record<string, AnyRoute>> {
	const files = [...new Bun.Glob('**/*.ts').scanSync(ROUTES)];
	const entries = await Promise.all(
		files.map(async (file) => {
			const module: { Route: AnyRoute } = await import(join(ROUTES, file));

			return [`routes/api/v1/${file}`, module.Route] as const;
		}),
	);

	return Object.fromEntries(entries);
}

const served = collectServedEndpoints(await loadApiRoutes());
const document = buildOpenApiDocument(listPublicOperations(served), {
	serverUrl: 'https://unbound.rip',
	version: '1.0.0',
});

function schemaNodes(schema: JsonSchema): JsonSchema[] {
	return [
		schema,
		...Object.values(schema.properties ?? {}),
		...Object.values(schema.patternProperties ?? {}),
		...(schema.anyOf ?? []),
		...(schema.items ? [schema.items] : []),
		...(typeof schema.additionalProperties === 'object' ? [schema.additionalProperties] : []),
	].flatMap((node, index) => (index === 0 ? [node] : schemaNodes(node)));
}

describe('the public operations', () => {
	test('each is served by a public endpoint of an /api/v1 route', () => {
		for (const key of Object.keys(PUBLIC_OPERATIONS)) {
			expect({ key, access: served.get(key)?.access }).toEqual({ key, access: 'public' });
		}
	});

	test('a caller endpoint reads as one, so the check above can fail', () => {
		expect(served.get('GET /api/v1/me')?.access).toBe('caller');
	});

	test('a public operation whose endpoint requires a caller is refused', () => {
		const me = served.get('GET /api/v1/me');
		const tampered = new Map(served);

		if (me) {
			tampered.set('GET /api/v1/catalog', me);
		}

		expect(() => listPublicOperations(tampered)).toThrow(
			'Public operation GET /api/v1/catalog requires a caller.',
		);
	});

	test('the sign-in handshake and crash reports stay out', () => {
		expect(Object.keys(document.paths)).not.toContain('/api/v1/auth/discord');
		expect(Object.keys(document.paths)).not.toContain('/api/v1/crash-reports');
	});
});

describe('toRoutePath', () => {
	test('maps a route file to the path it serves', () => {
		expect(toRoutePath('../../../routes/api/v1/addons/$id/versions.ts')).toBe(
			'/api/v1/addons/$id/versions',
		);
		expect(toRoutePath('routes/api/v1/openapi[.]json.ts')).toBe('/api/v1/openapi.json');
	});

	test('refuses names whose path it cannot tell', () => {
		for (const file of [
			'routes/api/_layout/a.ts',
			'routes/api/v1/index.ts',
			'routes/api/a.b.ts',
		]) {
			expect(() => toRoutePath(file)).toThrow(`Failed to map route file ${file} to a path`);
		}
	});
});

describe('toJsonSchema', () => {
	test('writes patterns as text, drops errorMessage and reads Type.Undefined() as absent', () => {
		const schema = Type.String({ pattern: /^[a-z]+$/, errorMessage: 'Lowercase only.' });

		expect(toJsonSchema(schema)).toEqual({ type: 'string', pattern: '^[a-z]+$' });
		expect(toJsonSchema(Type.Undefined())).toBeUndefined();
	});
});

describe('the OpenAPI document', () => {
	const schemas = Object.values(document.paths)
		.flatMap((methods) => Object.values(methods))
		.flatMap((operation) => [
			...(operation.parameters ?? []).map((parameter) => parameter.schema),
			...(operation.requestBody
				? [operation.requestBody.content['application/json'].schema]
				: []),
			operation.responses['200'].content['application/json'].schema,
		])
		.flatMap(schemaNodes);

	test('holds only plain JSON Schema', () => {
		expect(schemas.length).toBeGreaterThan(50);
		expect(schemas.filter((schema) => typeof schema.pattern === 'object')).toEqual([]);
		expect(schemas.filter((schema) => schema.type === 'undefined')).toEqual([]);
		expect(JSON.stringify(document)).not.toContain('errorMessage');
	});

	test('templates $id segments as {id} path parameters', () => {
		const operation = document.paths['/api/v1/addons/{id}/versions']?.get;

		expect(Object.keys(document.paths).filter((path) => path.includes('$'))).toEqual([]);
		expect(operation?.parameters).toEqual([
			{
				name: 'id',
				in: 'path',
				required: true,
				description: PUBLIC_OPERATIONS['GET /api/v1/addons/$id/versions'].parameters.id,
				schema: { type: 'string' },
			},
		]);
	});

	test('lists a query schema as query parameters and a body as the request body', () => {
		const loader = document.paths['/api/v1/loader/updates']?.get;
		const updates = document.paths['/api/v1/updates']?.post;

		expect(
			loader?.parameters?.map(({ name, in: where, required }) => [name, where, required]),
		).toEqual([
			['platform', 'query', true],
			['version', 'query', true],
		]);
		expect(loader?.requestBody).toBeUndefined();
		expect(updates?.requestBody?.content['application/json'].schema).toEqual(
			toJsonSchema(updatesRequestSchema) ?? {},
		);
	});

	test('describes only parameters an operation takes, and every query parameter of one it describes', () => {
		const operations = Object.values(document.paths).flatMap((methods) =>
			Object.values(methods),
		);

		for (const operation of operations) {
			const parameters = operation.parameters ?? [];

			if (parameters.some((parameter) => parameter.description)) {
				expect(
					parameters
						.filter((parameter) => !parameter.description)
						.map(({ name }) => name),
				).toEqual([]);
			}
		}

		for (const { method, path, endpoint, operation } of listPublicOperations(served)) {
			const taken = [
				...toOpenApiPath(path).names,
				...Object.keys(toJsonSchema(endpoint.schemas.query)?.properties ?? {}),
			];
			const unknown = Object.keys(operation.parameters ?? {}).filter(
				(name) => !taken.includes(name),
			);

			expect({ key: `${method} ${path}`, unknown }).toEqual({
				key: `${method} ${path}`,
				unknown: [],
			});
		}
	});

	test('does not document its own download route', () => {
		expect(Object.keys(document.paths)).not.toContain('/api/v1/openapi.json');
	});
});

describe('the HTTP reference', () => {
	const operations = groupOperations(document).flatMap((group) => group.operations);

	test('groups every operation under its tag, in tag order', () => {
		expect(groupOperations(document).map((group) => group.name)).toEqual([
			'Addons',
			'Updates',
			'Users',
		]);
		expect(operations).toHaveLength(Object.keys(PUBLIC_OPERATIONS).length);
	});

	test('lists body fields with their nested keys and limits', () => {
		const body = document.paths['/api/v1/updates']?.post?.requestBody;
		const fields = body ? getSchemaFields(body.content['application/json'].schema) : [];
		const addons = fields.find((field) => field.name === 'addons');

		expect(fields.map((field) => [field.name, field.required])).toEqual([
			['clientVersion', true],
			['addons', true],
		]);
		expect(addons?.type).toBe('object[]');
		expect(addons?.constraints).toContain('≤ 500 items');
		expect(addons?.fields.map((field) => field.name)).toEqual(['id', 'version', 'sha256']);
		expect(addons?.fields.find((field) => field.name === 'sha256')?.constraints).toEqual([
			'pattern ^[\\da-f]{64}$',
		]);
	});

	test('writes a curl call with the required query and body filled in', () => {
		const loader = operations.find((entry) => entry.path === '/api/v1/loader/updates');
		const updates = operations.find((entry) => entry.path === '/api/v1/updates');

		expect(loader && getCurlExample('https://unbound.rip', loader)).toBe(
			"curl 'https://unbound.rip/api/v1/loader/updates?platform=ios&version=<version>'",
		);
		expect(updates && getCurlExample('https://unbound.rip', updates)).toBe(
			[
				"curl -X POST 'https://unbound.rip/api/v1/updates' \\",
				"  -H 'content-type: application/json' \\",
				`  -d '{"clientVersion":"<clientVersion>","addons":[{"id":"<id>","version":"<version>"}]}'`,
			].join('\n'),
		);
	});
});
