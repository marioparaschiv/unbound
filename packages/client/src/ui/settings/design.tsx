import AddonList from '~/ui/addons/addon-list';
import { ManagerKind } from '~/lib/constants';
import { Empty, Page } from '~/ui/components';
import { useAddons } from '~/ui/hooks';
import { format } from '~/api/i18n';

/**
 * @description Settings page listing installed themes.
 */
function DesignPage() {
	const addons = useAddons(ManagerKind.Themes);

	if (!addons.length) {
		return <Empty>{format('UNBOUND_NO_ADDONS', { type: 'themes' })}</Empty>;
	}

	return (
		<Page>
			<AddonList addons={addons} kind={ManagerKind.Themes} />
		</Page>
	);
}

export default DesignPage;
