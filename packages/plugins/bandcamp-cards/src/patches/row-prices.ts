import { metro, patcher, plugins } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { bandcampPage, formatAmount, readPrice, type Price } from '~/lib/price';

type RowEmbed = { url?: string; provider?: { name?: string; url?: string } };
type GeneratedRow = { message?: { embeds?: RowEmbed[] } };
type RowManagerModule = { prototype: { generate: (...args: unknown[]) => GeneratedRow } };

const PROVIDER = 'Bandcamp';
const SEPARATOR = ' · ';

const prices = new Map<string, Price | null>();
let running = false;

function isRowManager(value: unknown): value is RowManagerModule {
	return (
		typeof Reflect.get(Object(Reflect.get(Object(value), 'prototype')), 'generate') ===
		'function'
	);
}

function label({ amount, currency, minimum }: Price): string {
	if (minimum > 0) return formatAmount(amount, currency);

	return amount > 0
		? format('NAME_YOUR_PRICE_FROM', { price: formatAmount(amount, currency) })
		: messages.NAME_YOUR_PRICE;
}

async function lookUp(page: string) {
	prices.set(page, null);

	try {
		const response = await fetch(page);
		const price = response.ok ? readPrice(await response.text(), page) : undefined;

		if (!price || !running) return;

		prices.set(page, price);
		plugins.redrawChat?.();
	} catch (error) {
		logger.error(`Failed to look up Bandcamp page ${page}:`, error);
	}
}

function priceRow(row: GeneratedRow | undefined) {
	const embeds = row?.message?.embeds;

	if (!embeds?.length) return;

	row!.message!.embeds = embeds.map((embed) => {
		const page = bandcampPage(embed.url);

		if (!page) return embed;

		if (!prices.has(page)) void lookUp(page);

		const price = prices.get(page);

		return price
			? {
					...embed,
					provider: { ...embed.provider, name: PROVIDER + SEPARATOR + label(price) },
				}
			: embed;
	});
}

/**
 * @description Writes each Bandcamp embed's price into the chat rows Discord builds, leaving the stored messages
 * untouched, and redraws the chat when a price arrives.
 * @returns A function that stops the lookups, or `undefined` when Discord moved its row builder.
 */
export function priceBandcampRows(): (() => void) | undefined {
	const RowManager: unknown = metro.findByName('RowManager', { interop: false });
	const rows = [Reflect.get(Object(RowManager), 'default'), RowManager].find(isRowManager);

	if (!rows) {
		logger.warn('Bandcamp prices skipped: Discord moved RowManager.');

		return undefined;
	}

	running = true;
	patcher.after(rows.prototype, 'generate', ({ result }) => priceRow(result as GeneratedRow));
	plugins.redrawChat?.();

	return () => {
		running = false;
		plugins.redrawChat?.();
	};
}

export default priceBandcampRows;
