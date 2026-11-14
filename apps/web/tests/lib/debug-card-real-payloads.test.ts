import { debugCardRequestSchema, type DebugCardRequest } from '@unbound-app/contracts/debug-cards';
import { unpackDebugAltText } from '@unbound-app/contracts/debug-card-alt-text';
import { safeParse } from '@unbound-app/contracts/schema';
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { debugCardSvg, layoutDebugCard } from '~/lib/debug-card/layout';
import { debugAltText } from '~/lib/debug-card/alt-text';

const FIXTURES = join(import.meta.dir, '../fixtures/debug-cards');
const PAYLOADS = ['ios-jailbroken.json', 'android-lsposed.json'];

async function readPayload(name: string): Promise<DebugCardRequest> {
	return Bun.file(join(FIXTURES, name)).json();
}

describe('debug cards from real device payloads', () => {
	for (const name of PAYLOADS) {
		test(`${name} passes the request schema`, async () => {
			const result = safeParse(debugCardRequestSchema, await readPayload(name));

			expect(result.success ? [] : result.error.issues).toEqual([]);
		});

		test(`${name} lays out and fits its alt text`, async () => {
			const payload = await readPayload(name);
			const now = new Date((payload.launch?.lastCheck?.at ?? Date.now()) + 60_000);
			const card = layoutDebugCard(payload, now);
			const alt = unpackDebugAltText(debugAltText(payload, {}, now));

			expect(debugCardSvg(card)).toContain('<svg');
			expect(alt).toBeTruthy();
			expect(JSON.parse(alt ?? '{}')).toMatchObject({ device: payload.device });
		});
	}
});
