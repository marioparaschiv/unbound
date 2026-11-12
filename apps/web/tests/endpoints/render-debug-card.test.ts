import { debugCardResponseSchema, type DebugCardRequest } from '@unbound-app/contracts/debug-cards';
import { unpackDebugAltText } from '@unbound-app/contracts/debug-card-alt-text';
import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';
import { afterAll, describe, expect, test } from 'bun:test';
import { parse } from '@unbound-app/contracts/schema';

import renderDebugCardEndpoint from '~/endpoints/render-debug-card';

import { createTestContext } from '../helpers/context';

const base = await createTestContext({ DEBUG_CARDS_RATE_LIMIT_MAX: '2' });
const ctx = base.ctx;

afterAll(base.close);

const info: DebugCardRequest = {
	client: 'v3.0.0',
	commit: '7e15ee37d',
	loader: '1.3.0',
	loaderOrigin: 'Unbound.dylib',
	framework: 'ElleKit 1.2',
	discord: '352.1',
	discordChannel: 'Stable',
	discordBuild: '120918',
	appSource: 'App Store',
	react: '19.2.3',
	reactNative: '0.86.0',
	hermes: '250829098.0.15',
	bytecode: '98',
	platform: 'iOS',
	os: '26.0.1 (23A355)',
	device: 'iPhone SE (2nd generation)',
	flags: ['Jailbroken', 'verified build'],
};

type SentCard = Omit<DebugCardRequest, 'device'> & { device?: string };

function send(body: SentCard, ip: string) {
	return renderDebugCardEndpoint.handle(
		ctx,
		new Request(new URL('/api/v1/debug-cards', ctx.env.PUBLIC_URL), {
			method: 'POST',
			headers: { 'content-type': 'application/json', [ctx.env.IP_ADDRESS_HEADER]: ip },
			body: JSON.stringify(body),
		}),
	);
}

describe('debug cards', () => {
	test('renders the report as a PNG with its alt text', async () => {
		const response = await send(info, '203.0.113.20');

		expect(response.status).toBe(200);

		const card = parse(debugCardResponseSchema, await response.json());

		expect(Buffer.from(card.image, 'base64').subarray(1, 4).toString()).toBe('PNG');
		expect(JSON.parse(unpackDebugAltText(card.altText) ?? '')).toMatchObject({
			unbound: '3.0.0',
			loader: '1.3.0',
		});
	});

	test('refuses malformed and oversized reports', async () => {
		const missing = await send({ ...info, device: undefined }, '203.0.113.21');

		expect(missing.status).toBe(400);
		expect(parse(apiErrorResponseSchema, await missing.json()).error.code).toBeString();

		const oversized = await send({ ...info, device: 'x'.repeat(129) }, '203.0.113.21');

		expect(oversized.status).toBe(400);
	});

	test('limits how often one address can render', async () => {
		const statuses: number[] = [];

		for (let attempt = 0; attempt < 3; attempt++) {
			statuses.push((await send(info, '203.0.113.22')).status);
		}

		expect(statuses).toEqual([200, 200, 429]);
	});
});
