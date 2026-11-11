import type { Addon } from '~/addons/addon';

import { loadPackIcons } from './icon-pack-icons';
import usePackSamples from './use-pack-samples';
import IconMarquee from './icon-marquee';

type IconPackPreviewProps = {
	pack: Addon;
};

/**
 * @description The picker's preview for an icon pack: every icon it draws, scrolling past on round buttons like
 * Discord's header actions, in place of the mock "Messages" list that shows almost no icons.
 */
function IconPackPreview({ pack }: IconPackPreviewProps) {
	const icons = usePackSamples(pack, loadPackIcons);

	return <IconMarquee icons={icons} />;
}

export default IconPackPreview;
