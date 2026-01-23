import { ModuleDeclarationKind, Project, VariableDeclarationKind } from 'ts-morph';
import { generateDtsBundle } from 'dts-bundle-generator';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENT_DIR = path.join(ROOT_DIR, 'packages/client');
const SDK_DIR = path.join(ROOT_DIR, 'packages/api');
const SDK_SRC_DIR = path.join(SDK_DIR, 'src');
const TEMP_TYPES_DIR = path.join(CLIENT_DIR, 'temp-types');

console.log('🔨 Generating plugin SDK types...\n');

// Clean and recreate SDK src directory
if (fs.existsSync(SDK_SRC_DIR)) {
	fs.rmSync(SDK_SRC_DIR, { recursive: true, force: true });
}
fs.mkdirSync(SDK_SRC_DIR, { recursive: true });

console.log('📦 Step 1: Generating TypeScript declarations with tsgo...\n');

try {
	execSync('bun run tsc --project tsconfig.json --declaration --emitDeclarationOnly --noEmit false --outDir temp-types', {
		cwd: CLIENT_DIR,
		stdio: 'inherit',
	});

	console.log('✓ Generated TypeScript declarations.\n');
} catch (error) {
	console.error('❌ TypeScript compilation failed');
	process.exit(1);
}

const typesApiDir = path.join(TEMP_TYPES_DIR, 'src', 'api');

if (!fs.existsSync(typesApiDir)) {
	console.error('❌ No API types directory found at:', typesApiDir);
	process.exit(1);
}

console.log('\n📋 Step 2: Scanning and determining exports...\n');

const moduleExports: Map<string, { modulePath: string; dtsFile: string }> = new Map();
const scanProject = new Project();

// First, find all index.d.ts files (these are always exported)
function findIndexFiles(dir: string, relativePath = ''): void {
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

		if (entry.isDirectory()) {
			findIndexFiles(fullPath, relPath);
		} else if (entry.isFile() && entry.name === 'index.d.ts') {
			const modulePath = relPath.replace('.d.ts', '');

			// Skip the root index.d.ts file - it will be our barrel export
			if (modulePath === 'index') continue;

			moduleExports.set(modulePath, { modulePath, dtsFile: fullPath });
		}
	}
}

findIndexFiles(typesApiDir);

// Second pass: for each index file, check what it re-exports and add those to moduleExports
console.log('Scanning index files for re-exports...\n');

for (const [modulePath, { dtsFile }] of Array.from(moduleExports.entries())) {
	const sourceFile = scanProject.addSourceFileAtPath(dtsFile);

	// Find all namespace re-exports
	for (const exportDecl of sourceFile.getExportDeclarations()) {
		const moduleSpecifier = exportDecl.getModuleSpecifierValue();
		if (!moduleSpecifier) continue;

		const namespaceExport = exportDecl.getNamespaceExport();
		if (namespaceExport && (moduleSpecifier.startsWith('./') || moduleSpecifier.startsWith('../'))) {
			// Resolve the relative path
			const moduleParts = modulePath.split('/');
			moduleParts.pop(); // Remove 'index'

			const importParts = moduleSpecifier.split('/');
			let currentDir = [...moduleParts];

			for (const part of importParts) {
				if (part === '..') {
					currentDir.pop();
				} else if (part !== '.') {
					currentDir.push(part);
				}
			}

			const submodulePath = currentDir.join('/');
			const submoduleFile = path.join(typesApiDir, submodulePath + '.d.ts');

			if (fs.existsSync(submoduleFile) && !moduleExports.has(submodulePath)) {
				console.log(`  Found re-export: ${modulePath} exports ${submodulePath}`);
				moduleExports.set(submodulePath, { modulePath: submodulePath, dtsFile: submoduleFile });
			}
		}
	}
}

console.log(`\nTotal modules to export: ${moduleExports.size}\n`);

const exportEntries = Array.from(moduleExports.entries());
const successfulExports: Array<string> = [];

// Track namespace re-exports that we need to restore later
const namespaceReExports = new Map<string, Array<{ name: string; from: string }>>();

// Build a set of all module paths we're going to export for quick lookup
const exportedModulePaths = new Set(exportEntries.map(([_, { modulePath }]) => modulePath));

// Pre-process: Remove namespace re-exports before bundling
const preProcessProject = new Project();

for (const [_, { modulePath, dtsFile }] of exportEntries) {
	const sourceFile = preProcessProject.addSourceFileAtPath(dtsFile);
	const reExports: Array<{ name: string; from: string }> = [];

	// Find 'export * as name from './submodule'' patterns
	for (const exportDecl of sourceFile.getExportDeclarations()) {
		const moduleSpecifier = exportDecl.getModuleSpecifierValue();
		if (!moduleSpecifier) continue;

		const namespaceExport = exportDecl.getNamespaceExport();
		if (namespaceExport && (moduleSpecifier.startsWith('./') || moduleSpecifier.startsWith('../'))) {
			const exportName = namespaceExport.getName();

			// Resolve the relative path to check if it's within our module's directory or the api folder
			// e.g., 'metro/index' + './filters' -> 'metro/filters'
			const moduleParts = modulePath.split('/');
			moduleParts.pop(); // Remove filename (e.g., 'index')
			const moduleDir = moduleParts.join('/'); // e.g., 'metro'

			// Parse the relative path
			const importParts = moduleSpecifier.split('/');
			let currentDir = [...moduleParts];

			for (const part of importParts) {
				if (part === '..') {
					currentDir.pop();
				} else if (part !== '.') {
					currentDir.push(part);
				}
			}

			const resolvedPath = currentDir.join('/');

			// Check if the resolved path is:
			// 1. Within the same module directory (e.g., metro/** for metro/index)
			// 2. Or anywhere in the api folder (going up is allowed within api)
			// 3. And it's in our export list
			const isWithinModule = moduleDir && resolvedPath.startsWith(moduleDir + '/');
			const isInApiFolder = resolvedPath.split('/').length >= 1; // All paths are within api
			const willBeExported = exportedModulePaths.has(resolvedPath);

			if ((isWithinModule || isInApiFolder) && willBeExported) {
				reExports.push({ name: exportName, from: moduleSpecifier });
				console.log(`  Pre-processing ${modulePath}: removing namespace re-export '${exportName}' from '${moduleSpecifier}' (-> ${resolvedPath}, will be bundled separately)`);
				// Remove this export declaration
				exportDecl.remove();
			} else {
				console.log(`  Pre-processing ${modulePath}: keeping namespace re-export '${exportName}' from '${moduleSpecifier}' (-> ${resolvedPath}, ${!willBeExported ? 'not in export list' : 'outside allowed scope'})`);
			}
		}
	}

	if (reExports.length > 0) {
		namespaceReExports.set(modulePath, reExports);
		sourceFile.saveSync();
		console.log(`  ✓ Temporarily removed ${reExports.length} namespace re-export(s) from ${modulePath}`);
	}
}

for (const [_, { modulePath, dtsFile }] of exportEntries) {
	console.log(`  Bundling ${modulePath}...`);

	try {
		const dtsOutput = generateDtsBundle([
			{
				filePath: dtsFile,
				output: {
					noBanner: true,
					sortNodes: true,
					exportReferencedTypes: false,
				},
			},
		], {
			preferredConfigPath: path.join(CLIENT_DIR, 'tsconfig.json'),
		});

		if (dtsOutput && dtsOutput[0]) {
			let finalOutput = dtsOutput[0];

			// Post-process: Add back the namespace re-exports
			if (namespaceReExports.has(modulePath)) {
				const reExports = namespaceReExports.get(modulePath)!;
				const reExportStatements = reExports
					.map(({ name, from }) => `export * as ${name} from '${from}';`)
					.join('\n');

				// Insert re-exports before the final 'export {};' statement
				finalOutput = finalOutput.replace(/export \{\};?\s*$/, `${reExportStatements}\n\nexport {};`);
				console.log(`  ✓ Restored ${reExports.length} namespace re-export(s) to ${modulePath}.d.ts`);
			}

			// Create directory structure: metro/index.ts -> src/metro/index.d.ts
			const outputPath = path.join(SDK_SRC_DIR, modulePath + '.d.ts');
			const outputDir = path.dirname(outputPath);

			fs.mkdirSync(outputDir, { recursive: true });
			fs.writeFileSync(outputPath, finalOutput);
			successfulExports.push(modulePath);
			console.log(`  ✓ Generated ${modulePath}.d.ts`);
		}
	} catch (error) {
		console.error(`  ✗ Failed to bundle ${modulePath}:`, error instanceof Error ? error.message : error);
	}
}

// Restore the original source files
for (const [_, { dtsFile }] of exportEntries) {
	const sourceFile = preProcessProject.getSourceFile(dtsFile);
	if (sourceFile) {
		// Reload from disk to restore original state
		sourceFile.refreshFromFileSystemSync();
	}
}

// Create a minimal global.d.ts file (kept for backwards compatibility, but empty)
const globalContent = `// Auto-generated by generate-plugin-sdk.ts - DO NOT EDIT

export {};
`;

fs.writeFileSync(path.join(SDK_SRC_DIR, 'global.d.ts'), globalContent);
console.log('\n✓ Generated src/global.d.ts');

const packageJson = {
	name: '@unbound-app/api',
	version: '1.0.0', // Placeholder - will be updated with hash at the end
	types: './src/index.ts',
	author: {
		name: 'Mario P.',
		email: 'contact@marioparaschiv.com',
		url: 'https://github.com/marioparaschiv'
	},
	exports: {
		'.': './src/index.ts',
		...Object.fromEntries(
			successfulExports.map((modulePath) => {
				// Remove '/index' suffix for cleaner paths: metro/index -> metro
				const exportPath = modulePath.endsWith('/index')
					? modulePath.slice(0, -6)
					: modulePath;
				return [`./${exportPath}`, `./src/${modulePath}.d.ts`];
			})
		),
	},
};

fs.writeFileSync(
	path.join(SDK_DIR, 'package.json'),
	JSON.stringify(packageJson, null, '\t') + '\n'
);
console.log('✓ Generated package.json (placeholder version)');

// Create tsconfig.json
const tsConfig = {
	compilerOptions: {
		module: 'ESNext',
		target: 'ESNext',
		moduleResolution: 'bundler',
		strict: true,
		skipLibCheck: true,
		declaration: true,
		declarationMap: true,
		esModuleInterop: true,
		forceConsistentCasingInFileNames: true,
	},
	include: ['src/**/*'],
};

fs.writeFileSync(
	path.join(SDK_DIR, 'tsconfig.json'),
	JSON.stringify(tsConfig, null, '\t') + '\n'
);
console.log('✓ Generated tsconfig.json');

console.log('\n📝 Step 3: Generating registry.d.ts...\n');

// Generate registry.d.ts with ts-morph
function generateRegistry(exports: string[]) {
	const project = new Project();
	const registryFile = project.createSourceFile(
		path.join(SDK_SRC_DIR, 'registry.d.ts'),
		'',
		{ overwrite: true }
	);

	// Add UnboundGlobal interface
	const unboundInterface = registryFile.addInterface({
		name: 'UnboundGlobal',
		isExported: true,
	});

	// Parse index files to find re-exported submodules
	// Returns a map of export name -> local import path
	function parseIndexExports(indexPath: string, moduleName: string): Map<string, string> {
		const reExports = new Map<string, string>();

		if (!fs.existsSync(indexPath)) {
			return reExports;
		}

		const sourceFile = project.addSourceFileAtPath(indexPath);

		// Find all export declarations with module specifiers (export ... from '...')
		for (const exportDecl of sourceFile.getExportDeclarations()) {
			const moduleSpecifier = exportDecl.getModuleSpecifierValue();
			if (!moduleSpecifier) continue;

			// Check if this is a namespace export (export * as name from '...')
			const namespaceExport = exportDecl.getNamespaceExport();
			if (namespaceExport) {
				const exportName = namespaceExport.getName();
				reExports.set(exportName, moduleSpecifier);
				console.log(`  Found namespace export: ${exportName} from ${moduleSpecifier}`);
			}

			// Also handle named exports that might re-export (export { filters } from '...')
			const namedExports = exportDecl.getNamedExports();
			for (const namedExport of namedExports) {
				const exportName = namedExport.getAliasNode()?.getText() ?? namedExport.getName();
				reExports.set(exportName, moduleSpecifier);
				console.log(`  Found named re-export: ${exportName} from ${moduleSpecifier}`);
			}
		}

		// Check for local exports that might correspond to submodules
		// e.g., 'export { filters }' when there's a filters.d.ts file
		for (const exportDecl of sourceFile.getExportDeclarations()) {
			// Only process exports without module specifiers (local exports)
			if (exportDecl.getModuleSpecifierValue()) continue;

			const namedExports = exportDecl.getNamedExports();
			for (const namedExport of namedExports) {
				const exportName = namedExport.getName();
				// Check if there's a corresponding .d.ts file for this export
				const correspondingFile = path.join(path.dirname(indexPath), `${exportName}.d.ts`);
				if (fs.existsSync(correspondingFile)) {
					reExports.set(exportName, `./${exportName}`);
					console.log(`  Found local export with corresponding file: ${exportName} -> ./${exportName}`);
				}
			}
		}

		if (reExports.size > 0) {
			console.log(`  Total re-exports found in ${moduleName}: ${reExports.size}`);
		}

		return reExports;
	}

	// Build hierarchical structure based on actual exports in index files
	type StructureNode = {
		exportPath?: string; // The clean export path (without /index) used in package.json
		filePath?: string; // The actual file path (with .d.ts)
		reExports: Map<string, string>; // Submodules re-exported by this module's index
	};

	const structure: Record<string, StructureNode> = {};

	// First pass: build basic structure
	for (const exportPath of exports) {
		const cleanPath = exportPath.endsWith('/index')
			? exportPath.slice(0, -6)
			: exportPath;

		const parts = cleanPath.split('/');
		if (parts.length === 0) continue;

		// Only process top-level modules
		if (parts.length === 1) {
			if (!structure[parts[0]]) {
				structure[parts[0]] = { reExports: new Map() };
			}
			structure[parts[0]].exportPath = cleanPath;
			structure[parts[0]].filePath = `./${exportPath}.d.ts`;

			// Parse the index file to find re-exports
			const indexFilePath = path.join(SDK_SRC_DIR, `${exportPath}.d.ts`);
			console.log(`\nParsing ${parts[0]}/index.d.ts for re-exports...`);
			structure[parts[0]].reExports = parseIndexExports(indexFilePath, parts[0]);
		}
	}

	// Add properties to UnboundGlobal interface
	// No need for intersection types - re-exports are handled directly in the .d.ts files
	for (const [key, node] of Object.entries(structure)) {
		unboundInterface.addProperty({
			name: key,
			type: node.filePath ? `typeof import('${node.filePath}')` : 'any',
		});
	}

	// Add global declaration
	const globalBlock = registryFile.addModule({
		name: 'global',
		hasDeclareKeyword: true,
		declarationKind: ModuleDeclarationKind.Global,
	});

	const windowInterface = globalBlock.addInterface({
		name: 'Window',
	});

	windowInterface.addProperty({
		name: 'unbound',
		type: 'UnboundGlobal',
	});

	globalBlock.addVariableStatement({
		declarationKind: VariableDeclarationKind.Const,
		declarations: [{
			name: 'unbound',
			type: `Window['unbound']`,
		}],
		hasDeclareKeyword: true,
	});

	// Add export statement
	registryFile.addExportDeclaration({});

	// Save the file
	registryFile.saveSync();
	console.log('✓ Generated registry.d.ts');
}

generateRegistry(successfulExports);

// Create index.ts to import registry
const indexTsContent = `import './registry.d.ts';
`;

fs.writeFileSync(path.join(SDK_SRC_DIR, 'index.ts'), indexTsContent);
console.log('✓ Generated index.ts');

console.log('\n🧹 Cleaning up temporary files...');
fs.rmSync(TEMP_TYPES_DIR, { recursive: true, force: true });

console.log('\n📝 Generating version hash from all SDK files...');

// Generate a hash of all generated files for a unique version identifier
const hash = createHash('sha256');

// Use glob to find all files in SDK src directory
function hashDirectory(dir: string) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			hashDirectory(fullPath);
		} else if (entry.isFile()) {
			// Read file as binary buffer for efficiency
			const buffer = fs.readFileSync(fullPath);
			hash.update(buffer);
		}
	}
}

hashDirectory(SDK_SRC_DIR);

const hashValue = hash.digest('hex');
const version = `1.0.0-${hashValue}`;

// Update package.json with the final version
packageJson.version = version;
fs.writeFileSync(
	path.join(SDK_DIR, 'package.json'),
	JSON.stringify(packageJson, null, '\t') + '\n'
);
console.log(`✓ Updated package.json version to ${version}`);

console.log(`\n🎉 Plugin SDK generated successfully with ${successfulExports.length} modules!\n`);
console.log('Modules:', successfulExports.join(', '));
