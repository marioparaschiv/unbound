import { existsSync, writeFileSync } from 'fs';
import Logger from '@unbound-app/logger';
import { execSync } from 'child_process';
import type { Plugin } from 'rolldown';
import { resolve } from 'path';

const logger = Logger.create('Build', 'Worklets');

const transpiler = new Bun.Transpiler({ loader: 'tsx', autoImportJSX: true });

export default function worklets(): Plugin {
	return {
		name: 'worklets',
		transform(source, id, meta) {
			// if(id.includes('node_modules')) return;
			// const imports = transpiler.scanImports(source);
			// const hasReanimated = imports.some(i => i.path === 'react-native-reanimated');
			// if(!hasReanimated) return;
			// console.log(imports)
			// this.
			// console.log(source)
		},
	};
}
