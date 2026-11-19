export type Coordinates = { latitude: number; longitude: number };

const DESCRIPTION = /<([+-]?\d+(?:\.\d+)?),\s*([+-]?\d+(?:\.\d+)?)>/;
const PRECISION = 100_000;

/**
 * @description Reads the coordinates out of a `CLLocation` description, such as `<+48.85840,+2.29450> +/- 5.00m`.
 * @param description The location's description.
 * @returns The coordinates, or `undefined` when the description has none.
 */
export function readCoordinates(description: string): Coordinates | undefined {
	const match = DESCRIPTION.exec(description);

	if (!match) return undefined;

	const latitude = Number(match[1]);
	const longitude = Number(match[2]);

	return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
		? { latitude, longitude }
		: undefined;
}

/**
 * @description Builds a map link anyone can open, rounded to about a metre.
 * @param coordinates Where to point.
 * @returns A Google Maps search link.
 */
export function mapLink({ latitude, longitude }: Coordinates): string {
	const round = (value: number) => Math.round(value * PRECISION) / PRECISION;

	return `https://www.google.com/maps/search/?api=1&query=${round(latitude)},${round(longitude)}`;
}
