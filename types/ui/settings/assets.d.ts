import type { Asset } from '@typings/discord/assets';


export interface AssetProps {
	item: Asset;
	id: number;
	index: number;
	total: number;
}