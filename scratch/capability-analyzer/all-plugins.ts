import { analyze } from './analyze.ts';
import { readdirSync, existsSync } from 'node:fs';
const root = new URL('../../packages/plugins', import.meta.url).pathname;
const rows = [];
for (const name of readdirSync(root)) {
	if (!existsSync(`${root}/${name}/manifest.json`)) continue;
	const r = analyze(`${root}/${name}`);
	rows.push({
		name,
		files: r.files.length,
		calls: r.calls.length,
		ios: r.variants['B whole graph filtered by platform table'].ios.length,
		android: r.variants['B whole graph filtered by platform table'].android.length,
		hand: r.handWritten.ios.length + r.handWritten.android.length,
		dyn: r.dynamic.length,
		ms: Math.round(r.ms.total),
		prog: Math.round(r.ms.program),
	});
	for (const d of r.dynamic) console.log('DYN', name, d.kind, d.file + ':' + d.line, d.text);
	const B = r.variants['B whole graph filtered by platform table'];
	for (const p of ['ios', 'android']) {
		const g = B[p],
			h = r.handWritten[p];
		const miss = h.filter((c) => !g.includes(c)),
			extra = g.filter((c) => !h.includes(c));
		if (miss.length || extra.length)
			console.log('DIFF', name, p, 'missing', miss.join(','), 'extra', extra.join(','));
	}
}
console.table(rows);
console.log(
	'total ms',
	rows.reduce((a, r) => a + r.ms, 0),
);
