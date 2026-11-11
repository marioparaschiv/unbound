import { registerOwnedAsset } from '~/assets/plugin-assets';

import { LOGO_BODY_PNG, LOGO_FRINGES_PNG } from './logo-images';

/** The logo's two layers as registered asset ids. */
export type LogoAssetIds = {
	/** `UnboundIcon-primary`: the body, drawn tinted. */
	body: number;
	/** `UnboundIcon-secondary`: the red and cyan fringes, drawn untinted under the body. */
	fringes: number;
};

/** Where the logo sits in the asset tree; an icon pack replaces it at `unbound/images/UnboundIcon-primary@3x.png`. */
const DIRECTORY = 'unbound/images';

let ids: LogoAssetIds | undefined;

function register(name: string, uri: string): number {
	return registerOwnedAsset(
		undefined,
		{ name, type: 'png', width: 24, height: 24, scales: { 3: uri } },
		DIRECTORY,
	).id;
}

/**
 * @description Registers the Unbound logo's layers with Discord's asset registry on first call, so icon packs and
 * add-ons can find and replace them by name like Discord's own two-layer icons.
 * @returns The layers' asset ids.
 */
export function getLogoAssetIds(): LogoAssetIds {
	ids ??= {
		body: register('UnboundIcon-primary', LOGO_BODY_PNG),
		fringes: register('UnboundIcon-secondary', LOGO_FRINGES_PNG),
	};

	return ids;
}

export default getLogoAssetIds;
