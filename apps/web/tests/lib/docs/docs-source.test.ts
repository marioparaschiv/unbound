import { describe, expect, test } from 'bun:test';

import { createDocsSource, MUTABLE_DOCS_TTL_MS } from '~/lib/docs/docs-source';

type Responder = () => Response | Promise<Response>;

const { preconnect } = globalThis.fetch;

function manifestResponse(versions: string[]): Response {
	return Response.json({ package: 'api', versions });
}

function setup(first: string[]) {
	let clock = 0;
	let respond: Responder = () => manifestResponse(first);
	const requests: string[] = [];
	const source = createDocsSource({
		cdnUrl: (key) => `https://cdn.test/${key}`,
		fetch: Object.assign(
			async (input: string | URL | Request) => {
				requests.push(input instanceof Request ? input.url : input.toString());

				return respond();
			},
			{ preconnect },
		),
		now: () => clock,
	});

	return {
		source,
		requests,
		advance: (ms: number) => {
			clock += ms;
		},
		respondWith: (next: Responder) => {
			respond = next;
		},
	};
}

describe('createDocsSource', () => {
	test('serves an expired manifest at once and refreshes it in the background', async () => {
		const docs = setup(['main']);

		expect((await docs.source.manifest('api'))?.versions).toEqual(['main']);

		let release = () => {};
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});

		docs.respondWith(async () => {
			await held;

			return manifestResponse(['main', 'v1.2.0']);
		});
		docs.advance(MUTABLE_DOCS_TTL_MS + 1);

		expect((await docs.source.manifest('api'))?.versions).toEqual(['main']);
		expect((await docs.source.manifest('api'))?.versions).toEqual(['main']);
		expect(docs.requests).toHaveLength(2);

		release();
		await Bun.sleep(0);

		expect((await docs.source.manifest('api'))?.versions).toEqual(['main', 'v1.2.0']);
		expect(docs.requests).toHaveLength(2);
	});

	test('keeps the old manifest when a refresh fails, and retries on the next read', async () => {
		const docs = setup(['main']);

		await docs.source.manifest('api');
		docs.respondWith(() => new Response('down', { status: 503 }));
		docs.advance(MUTABLE_DOCS_TTL_MS + 1);

		expect((await docs.source.manifest('api'))?.versions).toEqual(['main']);
		await Bun.sleep(0);

		docs.respondWith(() => manifestResponse(['main', 'v1.2.0']));

		expect((await docs.source.manifest('api'))?.versions).toEqual(['main']);
		await Bun.sleep(0);

		expect((await docs.source.manifest('api'))?.versions).toEqual(['main', 'v1.2.0']);
		expect(docs.requests).toHaveLength(3);
	});
});
