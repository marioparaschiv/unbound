import { afterAll, describe, expect, test } from 'bun:test';

import {
	SPONSORED_LOGIN,
	WEBHOOK_SECRET,
	deliver,
	sign,
	sponsorshipPayload,
	storedSponsorship,
} from './helpers/sponsors';
import { createTestContext } from './helpers/context';

const NOW = new Date('2026-03-01T00:00:00Z');

const base = await createTestContext({
	GITHUB_SPONSORS_LOGIN: SPONSORED_LOGIN.toUpperCase(),
	GITHUB_SPONSORS_WEBHOOK_SECRET: WEBHOOK_SECRET,
});
const ctx = { ...base.ctx, now: () => NOW };
const unconfigured = await createTestContext();
const withoutLogin = await createTestContext({ GITHUB_SPONSORS_WEBHOOK_SECRET: WEBHOOK_SECRET });

afterAll(async () => {
	await Promise.all([base.close(), unconfigured.close(), withoutLogin.close()]);
});

async function statusOf(response: Response) {
	return { code: response.status, body: await response.json() };
}

describe('webhook authentication', () => {
	const payload = sponsorshipPayload({ action: 'created', sponsorId: '100' });

	test('a correctly signed delivery is applied', async () => {
		const response = await deliver(ctx, payload, { id: 'auth-ok' });

		expect(await statusOf(response)).toEqual({ code: 200, body: { status: 'applied' } });
		expect(await storedSponsorship(ctx, '100')).toMatchObject({
			state: 'active',
			tierName: '$5 a month',
		});
	});

	test('a wrong secret, a tampered body and a missing signature are refused', async () => {
		const body = JSON.stringify(sponsorshipPayload({ action: 'created', sponsorId: '101' }));
		const tampered = body.replace('500', '50000');

		const responses = await Promise.all([
			deliver(ctx, body, { id: 'auth-secret', secret: 'not-the-secret' }),
			deliver(ctx, tampered, { id: 'auth-tamper', signature: sign(WEBHOOK_SECRET, body) }),
			deliver(ctx, body, { id: 'auth-missing', signature: null }),
			deliver(ctx, body, { id: 'auth-short', signature: 'sha256=abc' }),
		]);

		expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401]);
		expect(await storedSponsorship(ctx, '101')).toBeUndefined();
	});

	test('the endpoint does not exist without a webhook secret and a sponsored login', async () => {
		const unset = await deliver(unconfigured.ctx, payload, { id: 'auth-unset' });
		const noLogin = await deliver(withoutLogin.ctx, payload, { id: 'auth-no-login' });

		expect([unset.status, noLogin.status]).toEqual([404, 404]);
	});

	test('oversized and non-JSON bodies are refused', async () => {
		const huge = await deliver(ctx, 'x'.repeat(1024 * 1024 + 1), { id: 'auth-huge' });
		const form = await deliver(ctx, payload, { id: 'auth-form', contentType: 'text/plain' });

		expect([huge.status, form.status]).toEqual([413, 415]);
	});
});

describe('webhook events', () => {
	test('ping, other events and other sponsored accounts are acknowledged without changes', async () => {
		const other = sponsorshipPayload({
			action: 'created',
			sponsorId: '200',
			sponsorable: 'someone-else',
		});

		const responses = await Promise.all([
			deliver(ctx, { zen: 'Keep it logically awesome.' }, { id: 'evt-ping', event: 'ping' }),
			deliver(ctx, other, { id: 'evt-other' }),
		]);

		expect(responses.map((response) => response.status)).toEqual([202, 202]);
		expect(await storedSponsorship(ctx, '200')).toBeUndefined();
	});

	test('created, pending cancellation then cancelled moves through each state', async () => {
		const id = '300';

		await deliver(ctx, sponsorshipPayload({ action: 'created', sponsorId: id }), {
			id: 'seq-1',
		});
		expect(await storedSponsorship(ctx, id)).toMatchObject({ state: 'active', endsAt: null });

		await deliver(
			ctx,
			sponsorshipPayload({
				action: 'pending_cancellation',
				sponsorId: id,
				effectiveDate: '2026-04-01T00:00:00+00:00',
			}),
			{ id: 'seq-2' },
		);
		expect(await storedSponsorship(ctx, id)).toMatchObject({
			state: 'pending_cancellation',
			endsAt: new Date('2026-04-01T00:00:00Z'),
		});

		await deliver(ctx, sponsorshipPayload({ action: 'cancelled', sponsorId: id }), {
			id: 'seq-3',
		});
		expect(await storedSponsorship(ctx, id)).toMatchObject({ state: 'cancelled', endsAt: NOW });
	});

	test('a tier change updates the tier and keeps the state', async () => {
		const id = '350';

		await deliver(ctx, sponsorshipPayload({ action: 'created', sponsorId: id }), {
			id: 'tier-1',
		});
		await deliver(
			ctx,
			sponsorshipPayload({
				action: 'tier_changed',
				sponsorId: id,
				tierName: '$1 a month',
				cents: 100,
			}),
			{ id: 'tier-2' },
		);

		expect(await storedSponsorship(ctx, id)).toMatchObject({
			state: 'active',
			tierName: '$1 a month',
			monthlyPriceCents: 100,
		});
	});

	test('replaying a delivery id changes nothing, even after a later event', async () => {
		const id = '400';
		const created = sponsorshipPayload({ action: 'created', sponsorId: id });

		await deliver(ctx, created, { id: 'replay-1' });
		await deliver(ctx, sponsorshipPayload({ action: 'cancelled', sponsorId: id }), {
			id: 'replay-2',
		});

		const before = await storedSponsorship(ctx, id);
		const response = await deliver(ctx, created, { id: 'replay-1' });

		expect(await statusOf(response)).toEqual({ code: 200, body: { status: 'duplicate' } });
		expect(await storedSponsorship(ctx, id)).toEqual(before);
		expect(before?.state).toBe('cancelled');
	});

	test('a cancellation delivered before its creation stays cancelled', async () => {
		const id = '500';

		await deliver(ctx, sponsorshipPayload({ action: 'cancelled', sponsorId: id }), {
			id: 'order-1',
		});
		await deliver(ctx, sponsorshipPayload({ action: 'created', sponsorId: id }), {
			id: 'order-2',
		});

		expect((await storedSponsorship(ctx, id))?.state).toBe('cancelled');

		await deliver(
			ctx,
			sponsorshipPayload({
				action: 'created',
				sponsorId: id,
				createdAt: '2026-02-15T00:00:00+00:00',
			}),
			{ id: 'order-3' },
		);

		expect(await storedSponsorship(ctx, id)).toMatchObject({ state: 'active', endsAt: null });
	});
});
