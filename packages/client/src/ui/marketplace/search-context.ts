import { createContext } from 'react';

/** The marketplace's search text, shared by every tab's page. */
const SearchContext = createContext('');

export default SearchContext;
