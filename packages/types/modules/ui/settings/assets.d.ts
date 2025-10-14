import type { Asset } from '../../discord/assets';


export interface AssetProps {
	item: Asset;
	id: number;
	index: number;
	total: number;
}