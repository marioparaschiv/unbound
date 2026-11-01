import type { AddonKind } from '@unbound-app/types/addons';

// Nucleo Micro Bold's IconPlug and IconPalette, as apps/web's renderAddonIcon emits them, so the
// defaults match the website's and draw through the same SvgXml path as a picked icon.
const PLUG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><line x1="7" y1="6" x2="7" y2="3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></line><line x1="13" y1="6" x2="13" y2="3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></line><line x1="10" y1="17" x2="10" y2="15" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></line><path d="m5,6h10c.5519,0,1,.4481,1,1v2c0,3.3115-2.6885,6-6,6h0c-3.3115,0-6-2.6885-6-6v-2c0-.5519.4481-1,1-1Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>';

const PALETTE =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><line x1="3" y1="7.5" x2="17" y2="7.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></line><line x1="3" y1="12.5" x2="17" y2="12.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></line><rect x="3" y="3" width="14" height="14" rx="3" ry="3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></rect></svg>';

/** The icon each addon kind shows when its maintainers picked none. */
const DEFAULT_ADDON_ICONS: Record<AddonKind, string> = {
	plugin: PLUG,
	theme: PALETTE,
	'icon-pack': PALETTE,
	font: PALETTE,
};

export default DEFAULT_ADDON_ICONS;
