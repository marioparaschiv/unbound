export type ProviderId = 'tenor' | 'giphy' | 'klipy';

export type ReplacementProviderId = Exclude<ProviderId, 'klipy'>;

export type DiscordGif = {
	id: string;
	title: string;
	url: string;
	src: string;
	gif_src: string;
	width: number;
	height: number;
	preview: string;
};

export type TrendingCategory = {
	name: string;
	src: string;
};

export type TrendingData = {
	categories: TrendingCategory[];
	gifs: { src: string }[];
};

export type ProviderContext = {
	locale: string;
	mediaFormat: string;
};

export type GifProvider = {
	search: (query: string, limit: number, context: ProviderContext) => Promise<DiscordGif[]>;
	searchSuggestions: (query: string, context: ProviderContext) => Promise<string[]>;
	getTrending: (limit: number, context: ProviderContext) => Promise<DiscordGif[]>;
	getCategories: (context: ProviderContext) => Promise<TrendingData | null>;
	registerShare: (id: string, query: string, context: ProviderContext) => Promise<void>;
};
