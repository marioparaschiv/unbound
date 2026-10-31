import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';

function SearchIcon() {
	return <Discord.TableRowIcon source={icons.MagnifyingGlassIcon ?? 0} />;
}

export default SearchIcon;
