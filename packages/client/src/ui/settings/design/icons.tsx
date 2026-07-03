import { ManagerKind } from '~/lib/constants';
import { AddonList } from '~/ui/addons';

/** The Icons tab: the shared addon list bound to the Icons manager. */
function IconsTab() {
	return <AddonList kind={ManagerKind.Icons} />;
}

export default IconsTab;
