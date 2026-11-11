const UNITS = [
	{ size: 1_000_000, suffix: 'M' },
	{ size: 1_000, suffix: 'K' },
] as const;

/**
 * @description Formats an addon's marketplace install count, like "1.2K" or, in full, "1,234".
 * @param count The install count.
 * @param short Whether to abbreviate thousands and millions, as a card's tight line needs.
 * @returns The number.
 */
export function formatInstalls(count: number, short: boolean = false): string {
	const unit = short ? UNITS.find(({ size }) => count >= size) : undefined;

	if (!unit) {
		return new Intl.NumberFormat().format(count);
	}

	// Hermes lacks Intl's compact notation, so the unit is applied by hand: 1234 reads "1.2K".
	const value = Math.floor((count / unit.size) * 10) / 10;

	return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}${unit.suffix}`;
}
