import useAddons from '~/ui/hooks/use-addons';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { format } from '~/i18n/api';

type AddonCountProps = {
	kind: 'plugin' | 'theme';
};

/**
 * @description The overview row's trailing count of a kind's enabled addons; nothing while none are installed.
 */
function AddonCount({ kind }: AddonCountProps) {
	const addons = useAddons(kind);
	const manager = Manager.for(kind);
	const enabled = addons.filter((addon) => manager.isEnabled(addon.id)).length;

	if (!addons.length) return null;

	return <Discord.TableRow.TrailingText text={format('UNBOUND_ENABLED_COUNT', { enabled })} />;
}

export default AddonCount;
