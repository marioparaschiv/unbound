import { ManagerKind } from '~/lib/constants';
import { AddonList } from '~/ui/addons';

/** The Themes tab: the shared addon list bound to the Themes manager. */
function ThemesTab() {
	return <AddonList kind={ManagerKind.Themes} />;
}

export default ThemesTab;
