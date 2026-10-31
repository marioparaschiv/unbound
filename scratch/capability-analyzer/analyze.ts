// Throwaway prototype for UB-129. Not production code; see README.md.
import { createRequire } from 'node:module';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { NATIVE_PLUGIN_METHOD_CAPABILITIES } from '../../packages/types/typings/native-methods';
import { NATIVE_PLUGIN_PLATFORM_CAPABILITIES } from '../../packages/types/typings/native';

const ROOT = join(import.meta.dir, '..', '..');
const ts: typeof import('typescript') = createRequire(
	join(ROOT, 'apps/sdk-generator/package.json'),
)('typescript');

type Platform = 'ios' | 'android';
const PLATFORMS: Platform[] = ['ios', 'android'];
const METHODS = NATIVE_PLUGIN_METHOD_CAPABILITIES as Record<string, string>;

type Call = { method: string; capability: string; file: string; line: number };
type Dynamic = { kind: string; file: string; line: number; text: string };
type Handler = { platform: Platform; file: string };
type FileFacts = { calls: Call[]; dynamic: Dynamic[]; imports: string[]; handlers: Handler[] };

function real(path: string) {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

export function analyze(pluginDir: string) {
	const t0 = performance.now();
	const manifest = JSON.parse(readFileSync(join(pluginDir, 'manifest.json'), 'utf8'));
	const entry = real(join(pluginDir, 'src', manifest.main));
	const configPath = join(pluginDir, 'tsconfig.json');
	const parsed = ts.getParsedCommandLineOfConfigFile(
		configPath,
		{},
		{
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic: () => {},
		},
	)!;
	const program = ts.createProgram({ rootNames: [entry], options: parsed.options });
	const checker = program.getTypeChecker();
	const tProgram = performance.now();

	// Namespace for each bridge type alias, read from NativePluginBridge in the shipped SDK typings.
	const aliasToNamespace = new Map<string, string>();

	for (const sf of program.getSourceFiles()) {
		if (!sf.isDeclarationFile) continue;

		ts.forEachChild(sf, (node) => {
			if (
				ts.isTypeAliasDeclaration(node) &&
				node.name.text === 'NativePluginBridge' &&
				ts.isTypeLiteralNode(node.type)
			) {
				aliasToNamespace.set('NativePluginBridge', '');

				for (const member of node.type.members) {
					if (
						ts.isPropertySignature(member) &&
						member.type &&
						ts.isTypeReferenceNode(member.type) &&
						ts.isIdentifier(member.name)
					) {
						aliasToNamespace.set(member.type.typeName.getText(sf), member.name.text);
					}
				}
			}
		});
	}

	function enclosingAlias(decl: ts.Node): string | undefined {
		let node: ts.Node | undefined = decl;

		while (node && !ts.isTypeAliasDeclaration(node)) node = node.parent;

		return node && ts.isTypeAliasDeclaration(node) ? node.name.text : undefined;
	}

	function namespaceOfMember(symbol: ts.Symbol | undefined): string | undefined {
		for (const decl of symbol?.declarations ?? []) {
			const alias = enclosingAlias(decl);

			if (alias && aliasToNamespace.has(alias)) return aliasToNamespace.get(alias);
		}

		return undefined;
	}

	// A value is a bridge when every property it has is declared on one bridge alias (covers Pick<...> too).
	function namespaceOfType(type: ts.Type): string | undefined {
		const props = checker.getNonNullableType(type).getProperties();

		if (!props.length) return undefined;

		const namespaces = new Set(props.map((p) => namespaceOfMember(p)));

		if (namespaces.size !== 1) return undefined;

		return [...namespaces][0];
	}

	// `{ java: NativeJavaBridge; hooks: ... }`: a local container whose members are SDK bridge types is safe.
	function isBridgeContainer(type: ts.Type) {
		const props = checker.getNonNullableType(type).getProperties();

		return (
			props.length > 0 &&
			props.every((p) => {
				const decl = p.valueDeclaration ?? p.declarations?.[0];

				if (!decl) return false;

				const t = checker.getTypeOfSymbolAtLocation(p, decl);

				return (
					namespaceOfMember(p) !== undefined ||
					(namespaceOfType(t) ?? '') !== '' ||
					![...aliasToNamespace.values()].includes(p.name)
				);
			})
		);
	}

	function isOpaque(type: ts.Type | undefined) {
		if (!type) return true;

		if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.NonPrimitive)) {
			return true;
		}

		// `{}` and other prop-less object types (Object.keys's parameter, for one).
		return Boolean(type.flags & ts.TypeFlags.Object) && type.getProperties().length === 0;
	}

	const facts = new Map<string, FileFacts>();

	function factsFor(sf: ts.SourceFile): FileFacts {
		const cached = facts.get(sf.fileName);

		if (cached) return cached;

		const result: FileFacts = { calls: [], dynamic: [], imports: [], handlers: [] };
		const file = relative(ROOT, sf.fileName);
		const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

		function record(ns: string, member: string, node: ts.Node) {
			const method = `${ns}.${member}`;
			const capability = METHODS[method];

			if (capability) result.calls.push({ method, capability, file, line: lineOf(node) });
		}

		function dynamic(kind: string, node: ts.Node) {
			result.dynamic.push({
				kind,
				file,
				line: lineOf(node),
				text: node.getText(sf).slice(0, 80),
			});
		}

		function addImport(spec: string) {
			const resolved = ts.resolveModuleName(
				spec,
				sf.fileName,
				program.getCompilerOptions(),
				ts.sys,
			).resolvedModule?.resolvedFileName;

			if (!resolved || resolved.endsWith('.d.ts')) return;

			const path = real(resolved);

			if (path.includes(`${sep}node_modules${sep}`)) return;

			result.imports.push(path);
		}

		function visit(node: ts.Node) {
			if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
				const clause = node.importClause;
				const typeOnly =
					clause?.isTypeOnly ||
					(clause &&
						!clause.name &&
						clause.namedBindings &&
						ts.isNamedImports(clause.namedBindings) &&
						clause.namedBindings.elements.every((e) => e.isTypeOnly));

				if (!typeOnly) addImport(node.moduleSpecifier.text);

				return;
			}

			if (
				ts.isExportDeclaration(node) &&
				!node.isTypeOnly &&
				node.moduleSpecifier &&
				ts.isStringLiteral(node.moduleSpecifier)
			) {
				addImport(node.moduleSpecifier.text);
			}

			if (
				ts.isCallExpression(node) &&
				(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
					(ts.isIdentifier(node.expression) && node.expression.text === 'require'))
			) {
				const [arg] = node.arguments;

				if (arg && ts.isStringLiteralLike(arg)) addImport(arg.text);
				else dynamic('non-literal import()', node);
			}

			if (ts.isCallExpression(node)) {
				const callee = node.expression;
				const name = ts.isIdentifier(callee)
					? callee.text
					: ts.isPropertyAccessExpression(callee)
						? callee.name.text
						: '';
				const [arg] = node.arguments;

				if (name === 'definePlatform' && arg && ts.isObjectLiteralExpression(arg)) {
					for (const prop of arg.properties) {
						const key = prop.name && ts.isIdentifier(prop.name) ? prop.name.text : '';
						const value = ts.isShorthandPropertyAssignment(prop)
							? prop.name
							: ts.isPropertyAssignment(prop)
								? prop.initializer
								: undefined;

						if (
							!PLATFORMS.includes(key as Platform) ||
							!value ||
							!ts.isIdentifier(value)
						) {
							dynamic('definePlatform handler is not an imported binding', prop);
							continue;
						}

						let symbol = ts.isShorthandPropertyAssignment(prop)
							? checker.getShorthandAssignmentValueSymbol(prop)
							: checker.getSymbolAtLocation(value);

						if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
							symbol = checker.getAliasedSymbol(symbol);
						}

						const decl = symbol?.declarations?.[0];

						if (!decl || decl.getSourceFile() === sf) {
							dynamic('definePlatform handler is not an imported binding', prop);
							continue;
						}

						result.handlers.push({
							platform: key as Platform,
							file: real(decl.getSourceFile().fileName),
						});
					}
				}
			}

			if (ts.isPropertyAccessExpression(node)) {
				const ns = namespaceOfMember(checker.getSymbolAtLocation(node.name));

				if (ns) record(ns, node.name.text, node);
			}

			if (ts.isElementAccessExpression(node)) {
				const ns = namespaceOfType(checker.getTypeAtLocation(node.expression));

				if (ns !== undefined) {
					const arg = node.argumentExpression;

					if (ts.isStringLiteralLike(arg)) record(ns, arg.text, node);
					else dynamic('computed member', node);
				}
			}

			if (ts.isObjectBindingPattern(node)) {
				const ns = namespaceOfType(checker.getTypeAtLocation(node));

				if (ns !== undefined) {
					for (const el of node.elements) {
						if (el.dotDotDotToken) {
							dynamic('rest destructuring', el);
							continue;
						}

						const key = el.propertyName ?? el.name;

						if (ts.isIdentifier(key) || ts.isStringLiteralLike(key))
							record(ns, key.text, el);
						else dynamic('computed destructuring', el);
					}
				}
			}

			// A bridge flowing into any/unknown/object, a spread or Object.* loses static visibility.
			if (ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) {
				if (namespaceOfType(checker.getTypeAtLocation(node.expression)) !== undefined) {
					dynamic('spread', node);
				}
			}

			if (
				(ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) &&
				ts.isExpression(node) &&
				!(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) &&
				namespaceOfType(checker.getTypeAtLocation(node)) !== undefined
			) {
				const parent = node.parent;
				const target = ts.isAsExpression(parent)
					? checker.getTypeFromTypeNode(parent.type)
					: checker.getContextualType(node);

				if (target && isOpaque(target)) {
					dynamic('bridge widened to any/unknown/object', node);
				} else if (
					target &&
					!(target.flags & ts.TypeFlags.TypeParameter) &&
					!ts.isBindingPattern(ts.isVariableDeclaration(parent) ? parent.name : parent) &&
					namespaceOfType(target) === undefined &&
					!(
						namespaceOfType(checker.getTypeAtLocation(node)) === '' &&
						isBridgeContainer(target)
					)
				) {
					dynamic(`bridge passed as non-SDK type ${checker.typeToString(target)}`, node);
				}
			}

			if (ts.isForInStatement(node)) {
				if (namespaceOfType(checker.getTypeAtLocation(node.expression)) !== undefined) {
					dynamic('for...in', node.expression);
				}
			}

			ts.forEachChild(node, visit);
		}

		visit(sf);
		facts.set(sf.fileName, result);

		return result;
	}

	function sourceFile(path: string) {
		const sf = program.getSourceFile(path);

		if (!sf) throw new Error(`not in program: ${path}`);

		return sf;
	}

	// Walk the runtime import graph from the entry; `skip` prunes files before they are entered.
	function walk(skip: (path: string) => boolean) {
		const seen = new Set<string>();
		const pruned: { from: string; to: string }[] = [];
		const queue = [entry];

		while (queue.length) {
			const path = queue.shift()!;

			if (seen.has(path)) continue;

			seen.add(path);

			for (const next of factsFor(sourceFile(path)).imports) {
				if (skip(next)) {
					pruned.push({ from: relative(ROOT, path), to: relative(ROOT, next) });
					continue;
				}

				queue.push(next);
			}
		}

		return { files: [...seen], pruned };
	}

	const platformDir = (path: string): Platform | undefined =>
		PLATFORMS.find((p) => path.split(sep).includes(p));

	const all = walk(() => false);
	const tAnalysis = performance.now();
	const allCalls = all.files.flatMap((f) => facts.get(f)!.calls);

	// Text-search baseline: `<ns>.<method>` with a conventional receiver name, for recall comparison.
	const textRe = /\b(objc|java|hooks|ffi|fabric|runtime|debug)\s*\.\s*([A-Za-z]+)\b/g;
	const textSites = new Set<string>();

	for (const f of all.files) {
		const lines = readFileSync(f, 'utf8').split('\n');

		lines.forEach((text, i) => {
			for (const m of text.matchAll(textRe)) {
				if (METHODS[`${m[1]}.${m[2]}`])
					textSites.add(`${relative(ROOT, f)}:${i + 1} ${m[1]}.${m[2]}`);
			}
		});
	}

	const typedSites = new Set(allCalls.map((c) => `${c.file}:${c.line} ${c.method}`));
	const baseline = {
		typed: typedSites.size,
		text: textSites.size,
		onlyText: [...textSites].filter((s) => !typedSites.has(s)),
		onlyTyped: [...typedSites].filter((s) => !textSites.has(s)),
	};
	const capsOf = (calls: Call[]) => [...new Set(calls.map((c) => c.capability))].sort();
	const allowed = (p: Platform, cap: string) =>
		(NATIVE_PLUGIN_PLATFORM_CAPABILITIES[p] as readonly string[]).includes(cap);

	const variants: Record<string, Record<Platform, string[]>> = {
		'A whole graph': { ios: capsOf(allCalls), android: capsOf(allCalls) },
		'B whole graph filtered by platform table': {
			ios: capsOf(allCalls).filter((c) => allowed('ios', c)),
			android: capsOf(allCalls).filter((c) => allowed('android', c)),
		},
	};

	const pruning: Record<Platform, { from: string; to: string }[]> = { ios: [], android: [] };
	const misplaced: Record<Platform, Call[]> = { ios: [], android: [] };
	const C: Record<Platform, string[]> = { ios: [], android: [] };

	for (const p of PLATFORMS) {
		const other = PLATFORMS.find((o) => o !== p)!;
		const graph = walk((path) => platformDir(path) === other);
		const calls = graph.files.flatMap((f) => facts.get(f)!.calls);

		C[p] = capsOf(calls);
		pruning[p] = graph.pruned;
		misplaced[p] = calls.filter((c) => !allowed(p, c.capability));
	}

	variants['C graph pruned at ios/ and android/ folders'] = C;

	// D: definePlatform handlers root their own graphs; everything else is shared by every platform.
	const handlers = all.files.flatMap((f) => facts.get(f)!.handlers);
	const handlerFiles = new Set(handlers.map((h) => h.file));
	const declared = [...new Set(handlers.map((h) => h.platform))];
	const platforms = declared.length ? declared : PLATFORMS;
	const violations: Record<Platform, Call[]> = { ios: [], android: [] };
	const D: Record<Platform, string[]> = { ios: [], android: [] };

	if (handlers.length) {
		const shared = walk((path) => handlerFiles.has(path));

		for (const p of platforms) {
			const own = new Set(shared.files);

			for (const h of handlers.filter((x) => x.platform === p)) {
				const queue = [h.file];

				while (queue.length) {
					const path = queue.shift()!;

					if (own.has(path)) continue;

					own.add(path);
					queue.push(
						...factsFor(sourceFile(path)).imports.filter(
							(next) => !handlerFiles.has(next) || next === h.file,
						),
					);
				}
			}

			const calls = [...own].flatMap((f) => facts.get(f)!.calls);

			D[p] = capsOf(calls);
			violations[p] = calls.filter((c) => !allowed(p, c.capability));
		}

		variants['D graph per definePlatform handler'] = D;
	}

	const handWritten: Record<Platform, string[]> = {
		ios: [...(manifest.platformCapabilities?.ios ?? manifest.capabilities ?? [])].sort(),
		android: [...(manifest.platformCapabilities?.android ?? [])].sort(),
	};

	return {
		id: manifest.id,
		handWritten,
		variants,
		calls: allCalls,
		dynamic: all.files.flatMap((f) => facts.get(f)!.dynamic),
		files: all.files.map((f) => relative(ROOT, f)),
		pruning,
		misplaced,
		baseline,
		platforms,
		handlers: handlers.map((h) => ({ ...h, file: relative(ROOT, h.file) })),
		violations,
		ms: {
			program: tProgram - t0,
			analysis: tAnalysis - tProgram,
			total: performance.now() - t0,
		},
	};
}

function diff(generated: string[], hand: string[]) {
	return {
		missing: hand.filter((c) => !generated.includes(c)),
		extra: generated.filter((c) => !hand.includes(c)),
	};
}

if (import.meta.main) {
	const args = process.argv.slice(2);
	const json = args.includes('--json');
	const names = args.filter((a) => !a.startsWith('--'));

	for (const name of names) {
		const dir = name.includes('/')
			? join(process.cwd(), name)
			: join(ROOT, 'packages/plugins', name);

		if (!existsSync(join(dir, 'manifest.json'))) continue;

		const r = analyze(dir);

		if (json) {
			console.log(JSON.stringify(r));
			continue;
		}

		console.log(
			`\n# ${r.id}  (${r.files.length} runtime files, ${r.ms.total.toFixed(0)} ms: program ${r.ms.program.toFixed(0)}, analysis ${r.ms.analysis.toFixed(0)})`,
		);
		console.log(`hand-written ios:     ${r.handWritten.ios.join(', ')}`);
		console.log(`hand-written android: ${r.handWritten.android.join(', ')}`);

		for (const [variant, lists] of Object.entries(r.variants)) {
			console.log(`\n## ${variant}`);

			for (const p of PLATFORMS) {
				const d = diff(lists[p], r.handWritten[p]);

				console.log(`  ${p}: [${lists[p].join(', ')}]`);
				console.log(
					`    vs hand-written: missing [${d.missing.join(', ')}] extra [${d.extra.join(', ')}]`,
				);
			}
		}

		console.log('\n## call sites');

		const byCap = new Map<string, Call[]>();

		for (const c of r.calls) byCap.set(c.capability, [...(byCap.get(c.capability) ?? []), c]);

		for (const [cap, calls] of [...byCap].sort()) {
			const sites = [...new Set(calls.map((c) => `${c.file}:${c.line} ${c.method}`))];

			console.log(
				`  ${cap} (${sites.length}): ${sites.slice(0, 3).join(' | ')}${sites.length > 3 ? ' | ...' : ''}`,
			);
		}

		for (const p of PLATFORMS) {
			console.log(`\n## C ${p}: edges pruned`);

			for (const e of r.pruning[p]) console.log(`  ${e.from} -> ${e.to}`);

			console.log(`## C ${p}: reachable calls the platform cannot have`);

			for (const c of r.misplaced[p]) console.log(`  ${c.file}:${c.line} ${c.method}`);
		}

		if (r.handlers.length) {
			console.log(`\n## D platforms: ${r.platforms.join(', ')}`);

			for (const h of r.handlers) console.log(`  handler ${h.platform}: ${h.file}`);

			for (const p of PLATFORMS) {
				for (const c of r.violations[p]) {
					console.log(
						`  BUILD ERROR ${p} handler reaches ${c.method}: ${c.file}:${c.line}`,
					);
				}
			}
		}

		console.log(
			`\n## text baseline: ${r.baseline.text} text sites, ${r.baseline.typed} typed sites`,
		);

		for (const s of r.baseline.onlyText) console.log(`  only text: ${s}`);

		for (const s of r.baseline.onlyTyped) console.log(`  only typed: ${s}`);

		console.log('\n## dynamic access');

		for (const d of r.dynamic) console.log(`  ${d.kind}: ${d.file}:${d.line} ${d.text}`);
	}
}
