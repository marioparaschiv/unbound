import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import addonIconAtlas from './vite/addon-icon-atlas';
import guideMdx from './vite/guide-mdx';

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		tailwindcss(),
		addonIconAtlas(),
		tanstackStart(),
		guideMdx(),
		viteReact({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
	],
});
