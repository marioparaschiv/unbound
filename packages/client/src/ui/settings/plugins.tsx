import AddonList from '~/ui/addons/addon-list';
import { ManagerKind } from '~/lib/constants';
import { Empty, Page } from '~/ui/components';
import { useAddons } from '~/ui/hooks';
import { format } from '~/api/i18n';

/**
 * @description Settings page listing installed plugins.
 */
function PluginsPage() {
	const addons = useAddons(ManagerKind.Plugins);

	if (!addons.length) {
		return <Empty>{format('UNBOUND_NO_ADDONS', { type: 'plugins' })}</Empty>;
	}

	return (
		<Page>
			<AddonList addons={addons} kind={ManagerKind.Plugins} />
		</Page>
	);
}

export default PluginsPage;
