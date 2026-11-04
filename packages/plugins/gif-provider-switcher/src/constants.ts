import type { ProviderId } from '~/types';

export const PLUGIN_NAME = 'GIF Provider Switcher';

export const DEFAULT_PROVIDER: ProviderId = 'tenor';

export const PROVIDERS: readonly { id: ProviderId; label: string }[] = [
	{ id: 'tenor', label: 'Tenor' },
	{ id: 'giphy', label: 'Giphy' },
	{ id: 'klipy', label: 'Klipy' },
];

export const TENOR_KEY = '3Z0688EVWYKH';

export const GIPHY_KEY = 'Gc7131jiJuvI7IdN0HZ1D7nh0ow5BU6g';

export const GIPHY_PAGE_SIZE = 50;

export const TENOR_PAGE_SIZE = 50;

export const SEARCH_LIMIT = 100;

export const TRENDING_LIMIT = 50;

export const INTEGRATION_LIMIT = 20;

export const SUGGESTION_LIMIT = 5;

export const DEFAULT_LOCALE = 'en-US';

export const DEFAULT_MEDIA_FORMAT = 'mp4';

export const GIF_PICKER_HEADER_PATH = 'modules/gif_picker/native/GIFPickerHeader.tsx';
