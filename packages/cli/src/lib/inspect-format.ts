import type { ClassReport, ViewRecord, ViewsReport } from '~/lib/inspect-probe';

const DISCORD_PREFIX = /^com\.discord\./;

/**
 * @description Renders a class description: its superclass chain, interfaces, constructors, methods with static markers, and fields, each list sorted by name and narrowed to members whose name contains the filter.
 * @param report The description the device returned.
 * @param filter A member name substring; empty keeps every member.
 * @returns The printable description.
 */
export function formatClassReport(report: ClassReport, filter = ''): string {
	const simpleName = report.name.split(/[.$]/).pop() ?? report.name;
	const matches = (name: string) => !filter || name.toLowerCase().includes(filter.toLowerCase());
	const lines = [`class ${report.name}`];

	if (report.superclasses.length) {
		lines.push(`  extends ${report.superclasses.join(' < ')}`);
	}

	if (report.interfaces.length) {
		lines.push(`  implements ${report.interfaces.join(', ')}`);
	}

	if (!report.members) {
		lines.push(
			'',
			'The Objective-C bridge lists no methods, properties or ivars, so iOS shows the superclass chain only.',
		);

		return lines.join('\n');
	}

	const constructors = matches(simpleName) ? report.constructors : [];
	const methods = report.methods
		.filter((method) => matches(method.name))
		.sort((a, b) => a.name.localeCompare(b.name) || a.parameters.length - b.parameters.length);
	const fields = report.fields
		.filter((field) => matches(field.name))
		.sort((a, b) => a.name.localeCompare(b.name));

	lines.push('', `constructors (${constructors.length})`);
	lines.push(...constructors.map((parameters) => `  ${simpleName}(${parameters.join(', ')})`));
	lines.push('', `methods (${methods.length})`);
	lines.push(
		...methods.map(
			(method) =>
				`  ${method.static ? 'static ' : ''}${method.returnType} ${method.name}(${method.parameters.join(', ')})`,
		),
	);
	lines.push('', `fields (${fields.length})`);
	lines.push(
		...fields.map((field) => `  ${field.static ? 'static ' : ''}${field.type} ${field.name}`),
	);

	return lines.join('\n');
}

/**
 * @description Renders one view as a line: class, resource id, size, visibility, handle and a text snippet.
 * @param view The view the device described.
 * @param indent Whether to indent it by its depth.
 * @returns The printable line.
 */
export function formatViewRecord(view: ViewRecord, indent = true): string {
	const parts = [
		`${indent ? '  '.repeat(view.depth) : ''}${view.className.replace(DISCORD_PREFIX, '~')}`,
	];

	if (view.id) {
		parts.push(`#${view.id}`);
	}

	parts.push(`${view.width}x${view.height}`);

	if (view.visibility !== 'visible') {
		parts.push(view.visibility);
	}

	if (view.handle) {
		parts.push(`[${view.handle}]`);
	}

	if (view.text) {
		parts.push(`"${view.text}"`);
	}

	return parts.join(' ');
}

/**
 * @description Renders a view tree dump, one indented line per view and a blank line between roots.
 * @param report The views the device returned.
 * @param className The class the dump was rooted at, if any, for the empty message.
 * @returns The printable tree with a visit count.
 */
export function formatViewTree(report: ViewsReport, className = ''): string {
	const trees = report.roots.filter((tree) => tree.length);

	if (!trees.length) {
		return className ? `No attached ${className} view was found.` : 'No view was found.';
	}

	const body = trees.map((tree) => tree.map((view) => formatViewRecord(view)).join('\n'));

	return `${body.join('\n\n')}\n${summary(report)}`;
}

/**
 * @description Renders the attached views of a class, one line each.
 * @param report The views the device returned.
 * @param className The class searched for.
 * @returns The printable list with a count.
 */
export function formatFoundViews(report: ViewsReport, className: string): string {
	const views = report.roots.flat();

	if (!views.length) {
		return `No attached ${className} view was found. ${summary(report)}`.trim();
	}

	return `${views.map((view) => formatViewRecord(view, false)).join('\n')}\n${summary(report, views.length)}`;
}

function summary(report: ViewsReport, found?: number): string {
	const parts = [
		found === void 0 ? void 0 : `${found} found`,
		report.visited === null ? void 0 : `${report.visited} views visited`,
		report.truncated ? 'limit reached' : void 0,
	].filter(Boolean);

	return parts.length ? `(${parts.join(', ')})` : '';
}
