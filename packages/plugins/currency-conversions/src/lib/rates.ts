import { storage } from '@unbound-app/api';

import type { Rates } from '~/lib/convert';

const RATES_URL = 'https://api.frankfurter.dev/v1/latest?base=EUR';
const KEY = 'rates';
const MAX_AGE = 12 * 60 * 60 * 1000;

type StoredRates = Rates & { fetchedAt: number };

const bucket = storage.getBucket();

let loading: Promise<void> | undefined;

function readRates(value: unknown, fetchedAt: number): StoredRates | undefined {
	const body = value as { base?: unknown; rates?: unknown } | null;

	if (typeof body?.base !== 'string' || typeof body.rates !== 'object' || !body.rates)
		return undefined;

	const rates = Object.fromEntries(
		Object.entries(body.rates).filter(
			(entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0,
		),
	);

	return Object.keys(rates).length ? { base: body.base, rates, fetchedAt } : undefined;
}

/**
 * @description The saved exchange rates, from the European Central Bank through Frankfurter.
 * @returns The rates, or `undefined` before they first load.
 */
export function savedRates(): StoredRates | undefined {
	const saved = bucket.get(KEY, null) as { fetchedAt?: unknown } | null;

	return typeof saved?.fetchedAt === 'number' ? readRates(saved, saved.fetchedAt) : undefined;
}

async function fetchRates(): Promise<void> {
	try {
		const response = await fetch(RATES_URL, { headers: { Accept: 'application/json' } });
		const fresh = response.ok ? readRates(await response.json(), Date.now()) : undefined;

		if (fresh) bucket.set(KEY, fresh);
		else
			logger.warn(
				`Failed to load exchange rates from ${RATES_URL}: HTTP ${response.status}.`,
			);
	} catch (error) {
		logger.error(`Failed to load exchange rates from ${RATES_URL}:`, error);
	}
}

/**
 * @description Downloads fresh rates when the saved ones are missing or older than twelve hours; the central bank
 * publishes once per working day.
 * @returns A promise that settles once the rates are as fresh as they can be.
 */
export function refreshRates(): Promise<void> {
	const saved = savedRates();

	if (saved && Date.now() - saved.fetchedAt < MAX_AGE) return Promise.resolve();

	loading ??= fetchRates().finally(() => {
		loading = undefined;
	});

	return loading;
}

export default { savedRates, refreshRates };
