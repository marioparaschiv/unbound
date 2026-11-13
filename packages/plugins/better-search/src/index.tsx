import { addSearchFilters, removeSearchFilters } from '~/lib/search-rules';

export function start() {
	addSearchFilters();
}

export function stop() {
	removeSearchFilters();
}
