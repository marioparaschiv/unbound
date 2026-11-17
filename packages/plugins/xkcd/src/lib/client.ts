import { createXkcd } from '~/lib/comics';

export const xkcd = createXkcd((url) => fetch(url));
