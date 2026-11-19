import { priceBandcampRows } from '~/patches/row-prices';

let stopPrices: (() => void) | undefined;

export function start() {
	stopPrices = priceBandcampRows();
}

export function stop() {
	stopPrices?.();
	stopPrices = undefined;
}
