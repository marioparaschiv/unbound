import { AddonList, InstallButton } from '~/ui/addons';
import { ManagerKind } from '~/lib/constants';
import { Page } from '~/ui/components';

/**
 * @description The Plugins settings page: the shared addon list bound to the Plugins manager, with a
 * floating install button. The card holds the richness, so this page is thin.
 */
function PluginsPage() {
	return (
		<Page>
			<AddonList kind={ManagerKind.Plugins} />
			<InstallButton kind={ManagerKind.Plugins} />
		</Page>
	);
}

export default PluginsPage;
