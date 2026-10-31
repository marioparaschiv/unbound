import type {
	OpenSubmissionStatus,
	ReviewDecision,
	SubmissionKind,
	SubmissionStatus,
} from '@unbound-app/contracts/publish';
import type { AddonType, MaintainerRole } from '@unbound-app/contracts/addons';
import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';

import { LATEST_VERSION, getManifestType } from '~/lib/addons';
import { OPEN_SUBMISSION_STATUSES } from '~/lib/submissions';
import { submission, submissionSource } from '~/db/schema';
import type { Caller, CallerUser } from '~/lib/api/caller';
import { readReview } from '~/lib/submission-review';
import { renderAddonIcon } from '~/lib/addon-icons';
import { hasPermission } from '~/lib/auth/access';
import type { AppContext } from '~/lib/context';

export type Visibility = 'listed' | 'delisted';

/**
 * What a row's submit button does: `republish` supersedes the viewer's own submission with changes
 * requested; `update` submits a new version.
 */
export type SubmitIntent = 'republish' | 'update';

/** What the viewer may do with a row; the UI renders exactly these and checks nothing itself. */
export type AddonActions = {
	/** `null` when no submission is possible now, e.g. while the viewer's own listing is in review. */
	submit: SubmitIntent | null;
	maintainers: boolean;
	/** Every maintainer of an approved addon picks its website icon. */
	icon: boolean;
	publicPage: boolean;
	/** Staff with `addon:delist` manage delisting and transfers on the admin addons page. */
	staffManage: boolean;
};

/** The one open submission a row shows: the most urgent, the viewer's own first on ties. */
export type PendingSubmission = {
	id: string;
	version: string;
	status: OpenSubmissionStatus;
	/** The viewer authored it, so submitting the addon again supersedes it. */
	mine: boolean;
	note: string | null;
	/** Where it was read from, to submit from the same place again; `null` on legacy uploads. */
	source: PendingSource | null;
};

export type PendingSource = {
	repository: string;
	path: string;
};

export type LiveVersion = {
	version: string;
	publishedAt: string;
};

type AddonBase = {
	id: string;
	name: string;
	type: AddonType;
	/** The picked icon's SVG markup, rendered on the server; `null` for the type's default. */
	iconSvg: string | null;
	actions: AddonActions;
};

/** An approved addon the viewer maintains. */
export type PublishedAddon = AddonBase & {
	kind: 'published';
	role: MaintainerRole;
	visibility: Visibility;
	/** The website icon's Nucleo Micro Bold name; `null` for the type's default. */
	icon: string | null;
	live: LiveVersion | null;
	pending: PendingSubmission | null;
};

/** A new listing the viewer submitted that holds its addon id before any addon row exists. */
export type ListingAddon = AddonBase & {
	kind: 'listing';
	pending: PendingSubmission;
};

export type DashboardAddon = PublishedAddon | ListingAddon;

/** A reviewer's decision, which a superseded submission keeps, or still in review, or closed unreviewed. */
export type TimelineOutcome = ReviewDecision | 'pending_review' | 'cancelled';

/** One submission that reached review. */
export type TimelineEntry = {
	id: string;
	addonId: string;
	name: string;
	version: string;
	kind: SubmissionKind;
	outcome: TimelineOutcome;
	/** `reviewedAt` once reviewed, else `submittedAt`. */
	at: string;
	note: string | null;
	repository: string | null;
};

export type Dashboard = {
	/** Most urgent first: changes requested, in review, then the rest, delisted last. */
	addons: DashboardAddon[];
	/** At most `TIMELINE_LIMIT`, newest first. */
	timeline: TimelineEntry[];
	githubLinked: boolean;
};

type SubmissionRecord = {
	id: string;
	addonId: string;
	authorId: string;
	kind: SubmissionKind;
	status: SubmissionStatus;
	version: string;
	name: string;
	type: AddonType;
	repository: string | null;
	path: string | null;
	submittedAt: Date | null;
	reviewDecision: ReviewDecision | null;
	reviewedAt: Date | null;
	reviewNote: string | null;
};

type SubmissionRecordRow = Omit<SubmissionRecord, 'type'> & {
	manifestType: AddonType | null;
	main: string;
};

type OpenRecord = SubmissionRecord & {
	status: OpenSubmissionStatus;
};

type MaintainedAddonRow = NonNullable<
	Awaited<ReturnType<typeof queryMemberships>>[number]['addon']
>;

type AddonFacts = Omit<PublishedAddon, 'actions'> | Omit<ListingAddon, 'actions'>;

export const TIMELINE_LIMIT = 20;

const URGENCY: Record<OpenSubmissionStatus, number> = {
	changes_requested: 0,
	pending_review: 1,
};

const IDLE = Object.keys(URGENCY).length;

const OUTCOMES: Record<SubmissionStatus, TimelineOutcome | 'kept_decision' | null> = {
	pending_review: 'pending_review',
	changes_requested: 'changes_requested',
	approved: 'approved',
	rejected: 'rejected',
	cancelled: 'cancelled',
	superseded: 'kept_decision',
	expired: null,
};

const REPLACING_INTENTS: Partial<Record<OpenSubmissionStatus, SubmitIntent>> = {
	changes_requested: 'republish',
};

const RECORD_COLUMNS = {
	id: submission.id,
	addonId: submission.addonId,
	authorId: submission.authorId,
	kind: submission.kind,
	status: submission.status,
	version: submission.version,
	name: sql<string>`${submission.manifest} ->> 'name'`,
	manifestType: sql<AddonType | null>`${submission.manifest} ->> 'type'`,
	main: sql<string>`${submission.manifest} ->> 'main'`,
	repository: submission.repository,
	path: submissionSource.path,
	submittedAt: submission.submittedAt,
	reviewDecision: submission.reviewDecision,
	reviewedAt: submission.reviewedAt,
	reviewNote: submission.reviewNote,
};

function queryMemberships(ctx: AppContext, userId: string) {
	return ctx.db.query.addonMaintainer.findMany({
		where: { userId },
		with: { addon: { with: LATEST_VERSION } },
	});
}

function toRecord({ manifestType, main, ...row }: SubmissionRecordRow): SubmissionRecord {
	return { ...row, type: getManifestType({ type: manifestType ?? undefined, main }) };
}

function isOpen(record: SubmissionRecord): record is OpenRecord {
	return Object.hasOwn(URGENCY, record.status);
}

async function querySubmissions(ctx: AppContext, userId: string, addonIds: string[]) {
	const maintainedUpdates = and(
		inArray(submission.addonId, addonIds),
		eq(submission.kind, 'update'),
	);
	const ownListings = and(eq(submission.authorId, userId), eq(submission.kind, 'listing'));
	const scope = or(maintainedUpdates, ownListings);

	const [open, recent] = await Promise.all([
		ctx.db
			.select(RECORD_COLUMNS)
			.from(submission)
			.leftJoin(submissionSource, eq(submissionSource.submissionId, submission.id))
			.where(and(scope, inArray(submission.status, OPEN_SUBMISSION_STATUSES))),
		ctx.db
			.select(RECORD_COLUMNS)
			.from(submission)
			.leftJoin(submissionSource, eq(submissionSource.submissionId, submission.id))
			.where(and(scope, isNotNull(submission.submittedAt)))
			.orderBy(desc(submission.submittedAt), desc(submission.id))
			.limit(TIMELINE_LIMIT),
	]);

	return { open: open.map(toRecord).filter(isOpen), recent: recent.map(toRecord) };
}

function toPending(record: OpenRecord, viewer: CallerUser): PendingSubmission {
	return {
		id: record.id,
		version: record.version,
		status: record.status,
		mine: record.authorId === viewer.id,
		note: record.reviewNote,
		source:
			record.repository !== null && record.path !== null
				? { repository: record.repository, path: record.path }
				: null,
	};
}

function pickPending(records: OpenRecord[], viewer: CallerUser): PendingSubmission | null {
	const [first] = records
		.map((record) => toPending(record, viewer))
		.sort((a, b) => URGENCY[a.status] - URGENCY[b.status] || Number(b.mine) - Number(a.mine));

	return first ?? null;
}

function submitIntentFor(viewer: CallerUser, addon: AddonFacts): SubmitIntent | null {
	const replacing = addon.pending?.mine ? REPLACING_INTENTS[addon.pending.status] : undefined;

	if (replacing) {
		return replacing;
	}

	if (addon.kind === 'listing') return null;

	return hasPermission(viewer.role, { update: ['create'] }) ? 'update' : null;
}

function actionsFor(viewer: CallerUser, addon: AddonFacts): AddonActions {
	const published = addon.kind === 'published';

	return {
		submit: submitIntentFor(viewer, addon),
		maintainers: published && addon.role === 'owner',
		icon: published,
		publicPage: published && addon.visibility === 'listed',
		staffManage: published && hasPermission(viewer.role, { addon: ['delist'] }),
	};
}

function toPublishedAddon(
	viewer: CallerUser,
	row: MaintainedAddonRow,
	role: MaintainerRole,
	open: OpenRecord[],
): PublishedAddon {
	const [latest] = row.versions;
	const facts: Omit<PublishedAddon, 'actions'> = {
		kind: 'published',
		id: row.id,
		name: row.name,
		type: row.type,
		role,
		visibility: row.delistedAt ? 'delisted' : 'listed',
		icon: row.icon,
		iconSvg: renderAddonIcon(row.icon),
		live: latest
			? { version: latest.version, publishedAt: latest.publishedAt.toISOString() }
			: null,
		pending: pickPending(
			open.filter((record) => record.addonId === row.id && record.kind === 'update'),
			viewer,
		),
	};

	return { ...facts, actions: actionsFor(viewer, facts) };
}

function toListingAddon(viewer: CallerUser, record: OpenRecord): ListingAddon {
	const facts: Omit<ListingAddon, 'actions'> = {
		kind: 'listing',
		id: record.addonId,
		name: record.name,
		type: record.type,
		iconSvg: null,
		pending: toPending(record, viewer),
	};

	return { ...facts, actions: actionsFor(viewer, facts) };
}

function urgencyOf(addon: DashboardAddon): number {
	return addon.pending ? URGENCY[addon.pending.status] : IDLE;
}

function isDelisted(addon: DashboardAddon): boolean {
	return addon.kind === 'published' && addon.visibility === 'delisted';
}

function compareAddons(a: DashboardAddon, b: DashboardAddon): number {
	return (
		urgencyOf(a) - urgencyOf(b) ||
		Number(isDelisted(a)) - Number(isDelisted(b)) ||
		a.name.localeCompare(b.name)
	);
}

function toTimelineEntry(record: SubmissionRecord): TimelineEntry[] {
	const rule = OUTCOMES[record.status];
	const review = readReview(record);
	const outcome = rule === 'kept_decision' ? review?.decision : rule;
	const at = review?.reviewedAt ?? record.submittedAt;

	if (!outcome || !at) {
		return [];
	}

	return [
		{
			id: record.id,
			addonId: record.addonId,
			name: record.name,
			version: record.version,
			kind: record.kind,
			outcome,
			at: at.toISOString(),
			note: record.reviewNote,
			repository: record.repository,
		},
	];
}

/**
 * @description Loads `/dashboard` for the caller: the addons they maintain and their open new
 * listings, each with its most urgent open submission and allowed actions, and their recent submissions.
 * @param ctx The application context.
 * @param caller The signed-in user.
 * @param githubLinked Whether the caller has linked GitHub.
 * @returns The dashboard.
 */
export async function loadDashboard(
	ctx: AppContext,
	caller: Caller,
	githubLinked: boolean,
): Promise<Dashboard> {
	const viewer = caller.user;
	const memberships = await queryMemberships(ctx, viewer.id);
	const { open, recent } = await querySubmissions(
		ctx,
		viewer.id,
		memberships.map((membership) => membership.addonId),
	);

	const published = memberships.flatMap(({ addon, role }) =>
		addon ? [toPublishedAddon(viewer, addon, role, open)] : [],
	);

	const listings = open
		.filter((record) => record.kind === 'listing')
		.map((record) => toListingAddon(viewer, record));

	return {
		addons: [...published, ...listings].sort(compareAddons),
		timeline: recent.flatMap(toTimelineEntry).sort((a, b) => b.at.localeCompare(a.at)),
		githubLinked,
	};
}

export default { TIMELINE_LIMIT, loadDashboard };
