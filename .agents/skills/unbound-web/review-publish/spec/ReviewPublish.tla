---------------------------- MODULE ReviewPublish ----------------------------
(***************************************************************************)
(* Addon submission review and publishing in apps/web.                     *)
(* One addon id; each submission targets version "v1" (SubsV1) or "v2"     *)
(* (SubsV2). Line numbers refer to apps/web/src/lib/*.ts at the sync       *)
(* commit recorded in ../COVERAGE.md.                                      *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS
    SubsV1, SubsV2,        \* submission ids, by the version their manifest names
    Reviewers,             \* concurrent POST /api/v1/submissions/$id/review requests
    MaxPendingUpdates,     \* env SUBMISSION_MAX_PENDING_UPDATES (default 1)
    PublishAfterCommit,    \* TRUE = current code: public writes run after decide(); FALSE = before the fix
    CasOnStatus,           \* decide() WHERE status = 'pending_review' (submission-decision.ts:40)
    HashCheck,             \* re-hash check before any write (publish-version.ts verifyBundle)
    Recovery,              \* repeating an approved request republishes a live version's files (publish-version.ts hasPendingFiles)
    MaxWriteFailures,      \* public writes that fail after decide() commits, over a whole run
    AllowTamper,           \* Tamper may fire; FALSE only in the liveness config (see Fairness)
    ServeOnlyPublished,    \* TRUE = current code: updates and listings skip a version whose files are pending (addon-visibility.ts LIVE_VERSIONS)
    None                   \* model value: no row, no object

Subs     == SubsV1 \cup SubsV2
Versions == {"v1", "v2"}
VersionOf(s) == IF s \in SubsV1 THEN "v1" ELSE "v2"
Evil     == "evil"         \* bytes written to the staging bucket outside the app; s = s's pinned bundle
Open     == {"pending_review", "changes_requested"} \* OPEN_SUBMISSION_STATUSES
Decisions == {"approved", "rejected", "changes_requested"}

VARIABLES
    status,         \* submission.status
    kind,           \* submission.kind
    staged,         \* staging bucket object at submission.stagingKey
    recordedSha,    \* submission.sha256 (set by create from the bytes read at the pin)
    addonExists,    \* addon row for the id
    versionRow,     \* addon_version row per version: [sub, sha]
    publicBundle,   \* public bucket addons/{id}/{version}/{main}: [from, bytes]
    publicManifest, \* public bucket addons/{id}/{version}/manifest.json: submission whose row it renders
    publicPage,     \* public bucket addons/{id}/{version}/ADDON.md, page.json, media/*: submission they came from
    publicFiles,    \* public bucket addons/{id}/{version}/assets/*, i18n/*: submission whose manifest listed them
    decisions,      \* committed decide() transactions per submission
    fails,          \* public write failures so far
    pending,        \* addon_version.files_pending_since is set, per version
    pc, target, dec, rowSha, bytes, wroteB, wroteM, wroteP, wroteF \* per review request

vars == <<status, kind, staged, recordedSha, addonExists, versionRow, publicBundle,
          publicManifest, publicPage, publicFiles, decisions, fails, pending, pc, target, dec, rowSha,
          bytes, wroteB, wroteM, wroteP, wroteF>>

Init ==
    /\ status = [s \in Subs |-> None]
    /\ kind = [s \in Subs |-> None]
    /\ staged = [s \in Subs |-> None]
    /\ recordedSha = [s \in Subs |-> None]
    /\ addonExists = FALSE
    /\ versionRow = [v \in Versions |-> None]
    /\ publicBundle = [v \in Versions |-> None]
    /\ publicManifest = [v \in Versions |-> None]
    /\ publicPage = [v \in Versions |-> None]
    /\ publicFiles = [v \in Versions |-> None]
    /\ decisions = [s \in Subs |-> 0]
    /\ fails = 0
    /\ pending = [v \in Versions |-> FALSE]
    /\ pc = [r \in Reviewers |-> "idle"]
    /\ target = [r \in Reviewers |-> None]
    /\ dec = [r \in Reviewers |-> None]
    /\ rowSha = [r \in Reviewers |-> None]
    /\ bytes = [r \in Reviewers |-> None]
    /\ wroteB = [r \in Reviewers |-> FALSE]
    /\ wroteM = [r \in Reviewers |-> FALSE]
    /\ wroteP = [r \in Reviewers |-> FALSE]
    /\ wroteF = [r \in Reviewers |-> FALSE]

OpenSubs == {o \in Subs : status[o] \in Open}

ReviewerVars == <<pc, target, dec, rowSha, bytes, wroteB, wroteM, wroteP, wroteF>>
StoreVars    == <<addonExists, versionRow, publicBundle, publicManifest, publicPage, publicFiles,
                 decisions, fails, pending>>

(* ---------------- Authors and background jobs ---------------- *)

\* createSubmission -> stageAndReserve (submissions.ts:345-364): the bundle read from the pinned blob
\* is written to staging before the row exists. A refused claim deletes it again, which Orphan covers.
\* Only the bundle is staged; extra files and media never are.
Stage(s) ==
    /\ status[s] = None
    /\ staged' = [staged EXCEPT ![s] = s]
    /\ UNCHANGED <<status, kind, recordedSha, StoreVars, ReviewerVars>>

\* reserve(), one serializable transaction retried whole on a serialization failure (submissions.ts:268-343),
\* inserting the row as pending_review with the sha256 of the bytes read at the pin and the manifest,
\* whose assets and locales list each extra file's SHA-256. Update: addon exists, version not live,
\* open < cap (addon-claim.ts checkClaim 34-75, submissions.ts claimSubmission 166-232). Listing: no open submission claims the id (submission_listing_claim_uidx).
Create(s) ==
    /\ status[s] = None
    /\ IF addonExists
          THEN /\ versionRow[VersionOf(s)] = None
               /\ Cardinality(OpenSubs) < MaxPendingUpdates
               /\ kind' = [kind EXCEPT ![s] = "update"]
          ELSE /\ OpenSubs = {}
               /\ kind' = [kind EXCEPT ![s] = "listing"]
    /\ status' = [status EXCEPT ![s] = "pending_review"]
    /\ recordedSha' = [recordedSha EXCEPT ![s] = s]
    /\ UNCHANGED <<staged, StoreVars, ReviewerVars>>

\* No app path writes a staged object after create; this is a write outside the app (leaked bucket
\* credentials, an operator), at any time, which the approval re-hash must catch.
Tamper(s) ==
    /\ AllowTamper
    /\ status[s] # None
    /\ staged' = [staged EXCEPT ![s] = Evil]
    /\ UNCHANGED <<status, kind, recordedSha, StoreVars, ReviewerVars>>

\* purgeUserSubmissions on ban (staging.ts:116-155, auth.ts:144): cancels any open submission,
\* pending_review too. reserve()'s supersede (submissions.ts:287-291, 411) moves the author's own
\* changes_requested row out of Open and deletes its bundle: Purge then Create.
Purge(s) ==
    /\ status[s] \in Open
    /\ status' = [status EXCEPT ![s] = "cancelled"]
    /\ staged' = [staged EXCEPT ![s] = None]
    /\ UNCHANGED <<kind, recordedSha, StoreVars, ReviewerVars>>

\* sweepStaging -> deleteOrphans (staging.ts:24-75): deletes a staged object no open submission owns.
\* Status None over-approximates a create slower than STAGING_ORPHAN_GRACE_SECONDS; approval refetches.
Orphan(s) ==
    /\ status[s] \notin Open
    /\ staged[s] # None
    /\ staged' = [staged EXCEPT ![s] = None]
    /\ UNCHANGED <<status, kind, recordedSha, StoreVars, ReviewerVars>>

(* ---------------- reviewSubmission (review.ts:188-218) ---------------- *)

\* requireReviewable (review.ts:141-176): reads the row, then commitReview's status check (publish-version.ts:324).
Start(r, s, d) ==
    /\ pc[r] = "idle"
    /\ status[s] = "pending_review"
    /\ pc' = [pc EXCEPT ![r] = IF d = "approved" THEN "read" ELSE "decide"]
    /\ target' = [target EXCEPT ![r] = s]
    /\ dec' = [dec EXCEPT ![r] = d]
    /\ rowSha' = [rowSha EXCEPT ![r] = recordedSha[s]]
    /\ bytes' = [bytes EXCEPT ![r] = None]
    /\ wroteB' = [wroteB EXCEPT ![r] = FALSE]
    /\ wroteM' = [wroteM EXCEPT ![r] = FALSE]
    /\ wroteP' = [wroteP EXCEPT ![r] = FALSE]
    /\ wroteF' = [wroteF EXCEPT ![r] = FALSE]
    /\ UNCHANGED <<status, kind, staged, recordedSha, StoreVars>>

\* reviewSubmission repeated for an approved submission (publish-version.ts commitReview 322-330, hasPendingFiles 313-320): the
\* row is approved, its addon_version row still names this submission and its files are pending. Any
\* reviewer may repeat it. Skips decide() and goes to the reads.
RetryStart(r, s) ==
    /\ Recovery /\ PublishAfterCommit
    /\ pc[r] = "idle"
    /\ status[s] = "approved"
    /\ versionRow[VersionOf(s)] # None /\ versionRow[VersionOf(s)].sub = s
    /\ pending[VersionOf(s)]
    /\ pc' = [pc EXCEPT ![r] = "read"]
    /\ target' = [target EXCEPT ![r] = s]
    /\ dec' = [dec EXCEPT ![r] = "republish"]
    /\ rowSha' = [rowSha EXCEPT ![r] = recordedSha[s]]
    /\ bytes' = [bytes EXCEPT ![r] = None]
    /\ wroteB' = [wroteB EXCEPT ![r] = FALSE]
    /\ wroteM' = [wroteM EXCEPT ![r] = FALSE]
    /\ wroteP' = [wroteP EXCEPT ![r] = FALSE]
    /\ wroteF' = [wroteF EXCEPT ![r] = FALSE]
    /\ UNCHANGED <<status, kind, staged, recordedSha, StoreVars>>

Done(r) ==
    /\ pc' = [pc EXCEPT ![r] = "idle"]
    /\ UNCHANGED <<target, dec, rowSha, bytes, wroteB, wroteM, wroteP, wroteF>>

Got(r, b) ==
    /\ bytes' = [bytes EXCEPT ![r] = b]
    /\ pc' = [pc EXCEPT ![r] = IF dec[r] = "republish" \/ ~PublishAfterCommit THEN "write" ELSE "decide"]
    /\ UNCHANGED <<target, dec, rowSha, wroteB, wroteM, wroteP, wroteF>>

\* readVerified (publish-version.ts readAtPin 226-261): the staged bytes, or, when the object
\* is gone, the pinned blob read again (readBlob 223, or readPinnedFiles). The blob is content-addressed and readBlob checks its
\* SHA-1, so a refetch yields the honest bytes or fails with github_unavailable. Then the re-hash (verifyBundle 263-276); a
\* mismatch throws artifact_mismatch and the request ends. Two reads run alongside in one Promise.all:
\* readPageMedia (addon-page-source.ts 220-233) re-reads every media file, and readPinnedFiles (pinned-files.ts
\* 38-53, addon-files.ts readListedFiles 47-104) every extra file listAddonFiles names and compiled bundle, each checked against the SHA-256 the
\* row's manifest lists (a locale also against a JSON object of strings). Both read the pinned commit's
\* content-addressed blobs, never staging, so Tamper cannot reach them: they yield the submitted bytes or
\* throw, and a throw ends the request before any write (the Done branch).
ReadFail(r) ==
    /\ pc[r] = "read"
    /\ Done(r)
    /\ UNCHANGED <<status, kind, staged, recordedSha, StoreVars>>

ReadOk(r) ==
    LET s == target[r] IN
    /\ pc[r] = "read"
    /\ IF staged[s] = None
          THEN Got(r, s)
          ELSE IF HashCheck /\ staged[s] # rowSha[r]
                  THEN Done(r)
                  ELSE Got(r, staged[s])
    /\ UNCHANGED <<status, kind, staged, recordedSha, StoreVars>>

ReadStaged(r) == ReadFail(r) \/ ReadOk(r)

AfterWrite == IF PublishAfterCommit THEN "mark" ELSE "decide"

\* writeFiles writes after decide commits (publish-version.ts 308-311): writeArtifact (artifacts.ts 71-96) PUTs the bundle, the
\* manifest, each compiled bundle and each extra file at addons/{id}/{version}/<path>. writeStorePage (artifacts.ts 105-132) PUTs ADDON.md, page.json and each media file. All run
\* at once. Every submission here has a store page and extra files, the case with the most writes. The
\* page's PUTs are one action, and so are the extra files'.
WriteBundle(r) ==
    LET s == target[r] IN
    /\ pc[r] = "write" /\ ~wroteB[r]
    /\ publicBundle' = [publicBundle EXCEPT ![VersionOf(s)] = [from |-> s, bytes |-> bytes[r]]]
    /\ wroteB' = [wroteB EXCEPT ![r] = TRUE]
    /\ pc' = [pc EXCEPT ![r] = IF wroteM[r] /\ wroteP[r] /\ wroteF[r] THEN AfterWrite ELSE "write"]
    /\ UNCHANGED <<status, kind, staged, recordedSha, addonExists, versionRow, publicManifest,
                   publicPage, publicFiles, decisions, fails, pending, target, dec, rowSha, bytes, wroteM,
                   wroteP, wroteF>>

WriteManifest(r) ==
    LET s == target[r] IN
    /\ pc[r] = "write" /\ ~wroteM[r]
    /\ publicManifest' = [publicManifest EXCEPT ![VersionOf(s)] = s]
    /\ wroteM' = [wroteM EXCEPT ![r] = TRUE]
    /\ pc' = [pc EXCEPT ![r] = IF wroteB[r] /\ wroteP[r] /\ wroteF[r] THEN AfterWrite ELSE "write"]
    /\ UNCHANGED <<status, kind, staged, recordedSha, addonExists, versionRow, publicBundle,
                   publicPage, publicFiles, decisions, fails, pending, target, dec, rowSha, bytes, wroteB,
                   wroteP, wroteF>>

WritePage(r) ==
    LET s == target[r] IN
    /\ pc[r] = "write" /\ ~wroteP[r]
    /\ publicPage' = [publicPage EXCEPT ![VersionOf(s)] = s]
    /\ wroteP' = [wroteP EXCEPT ![r] = TRUE]
    /\ pc' = [pc EXCEPT ![r] = IF wroteB[r] /\ wroteM[r] /\ wroteF[r] THEN AfterWrite ELSE "write"]
    /\ UNCHANGED <<status, kind, staged, recordedSha, addonExists, versionRow, publicBundle,
                   publicManifest, publicFiles, decisions, fails, pending, target, dec, rowSha, bytes, wroteB,
                   wroteM, wroteF>>

\* writeArtifact's PUTs of the extra files and compiled bundles (artifacts.ts 81-90): the bytes readPinnedFiles read and
\* checked, so they are always the files s's manifest lists.
WriteFiles(r) ==
    LET s == target[r] IN
    /\ pc[r] = "write" /\ ~wroteF[r]
    /\ publicFiles' = [publicFiles EXCEPT ![VersionOf(s)] = s]
    /\ wroteF' = [wroteF EXCEPT ![r] = TRUE]
    /\ pc' = [pc EXCEPT ![r] = IF wroteB[r] /\ wroteM[r] /\ wroteP[r] THEN AfterWrite ELSE "write"]
    /\ UNCHANGED <<status, kind, staged, recordedSha, addonExists, versionRow, publicBundle,
                   publicManifest, publicPage, decisions, fails, pending, target, dec, rowSha, bytes, wroteB,
                   wroteM, wroteP>>

\* markFilesPublished (publish-version.ts 213-222), one transaction after every write landed: clears
\* files_pending_since on the row that still names this submission, so the version starts being served.
MarkPublished(r) ==
    LET s == target[r]
        v == VersionOf(s)
    IN
    /\ pc[r] = "mark"
    /\ pending' = IF versionRow[v] # None /\ versionRow[v].sub = s
                     THEN [pending EXCEPT ![v] = FALSE]
                     ELSE pending
    /\ pc' = [pc EXCEPT ![r] = "cleanup"]
    /\ UNCHANGED <<status, kind, staged, recordedSha, addonExists, versionRow, publicBundle,
                   publicManifest, publicPage, publicFiles, decisions, fails, target, dec, rowSha, bytes,
                   wroteB, wroteM, wroteP, wroteF>>

\* A public PUT fails after decide() committed (or during a republish), or markFilesPublished's transaction
\* fails: the request errors out of writeFiles with the files still pending, so no cleanup runs, the
\* version stays live and whichever writes landed stay public. At most MaxWriteFailures over a run.
WriteFail(r) ==
    /\ pc[r] \in {"write", "mark"}
    /\ PublishAfterCommit
    /\ fails < MaxWriteFailures
    /\ fails' = fails + 1
    /\ Done(r)
    /\ UNCHANGED <<status, kind, staged, recordedSha, addonExists, versionRow, publicBundle,
                   publicManifest, publicPage, publicFiles, decisions, pending>>

\* decide (publish-version.ts commitReview 333-339): one serializable transaction, retried whole on a
\* serialization failure. CAS at submission-decision.ts 40, throw at 44-46. Approval runs recordApproval (336), whose makeLive
\* inserts addon (134, PK id) for a listing and addon_version (149, PK addonId+version); a conflict throws and rolls it all back.
Decide(r) ==
    LET s == target[r]
        v == VersionOf(s)
        d == dec[r]
        casFails == CasOnStatus /\ status[s] # "pending_review"
        conflict == d = "approved" /\ (versionRow[v] # None \/ (kind[s] = "listing" /\ addonExists))
    IN
    /\ pc[r] = "decide"
    /\ IF casFails \/ conflict
          THEN /\ Done(r)
               /\ UNCHANGED <<status, StoreVars>>
          ELSE /\ status' = [status EXCEPT ![s] = d]
               /\ decisions' = [decisions EXCEPT ![s] = @ + 1]
               /\ IF d = "approved"
                     THEN /\ versionRow' = [versionRow EXCEPT ![v] = [sub |-> s, sha |-> bytes[r]]]
                          /\ addonExists' = TRUE
                          \* toVersionRow sets files_pending_since; before the fix the files were already written.
                          /\ pending' = [pending EXCEPT ![v] = PublishAfterCommit]
                     ELSE UNCHANGED <<versionRow, addonExists, pending>>
               /\ pc' = [pc EXCEPT ![r] =
                        IF d = "approved" /\ PublishAfterCommit THEN "write" ELSE "cleanup"]
               /\ UNCHANGED <<publicBundle, publicManifest, publicPage, publicFiles, fails, target, dec,
                              rowSha, bytes, wroteB, wroteM, wroteP, wroteF>>
    /\ UNCHANGED <<kind, staged, recordedSha>>

\* review.ts:206-208: approve and reject delete the staged bundle; changes_requested keeps it.
Cleanup(r) ==
    LET s == target[r] IN
    /\ pc[r] = "cleanup"
    /\ staged' = IF dec[r] = "changes_requested" THEN staged ELSE [staged EXCEPT ![s] = None]
    /\ Done(r)
    /\ UNCHANGED <<status, kind, recordedSha, StoreVars>>

Next ==
    \/ \E s \in Subs : Stage(s) \/ Create(s) \/ Tamper(s) \/ Purge(s) \/ Orphan(s)
    \/ \E r \in Reviewers, s \in Subs, d \in Decisions : Start(r, s, d)
    \/ \E r \in Reviewers, s \in Subs : RetryStart(r, s)
    \/ \E r \in Reviewers : ReadStaged(r) \/ WriteBundle(r) \/ WriteManifest(r) \/ WritePage(r)
                          \/ WriteFiles(r) \/ MarkPublished(r) \/ WriteFail(r) \/ Decide(r)
                          \/ Cleanup(r)

\* Fairness for the liveness check: a request in flight keeps moving (weak), and someone repeats the
\* approval whenever it can be (strong: a failed read or write returns the request to idle, so the
\* retry is enabled only intermittently). Environment steps (Tamper, Orphan, Purge, a failing read) get none.
Fairness ==
    /\ SF_vars(\E r \in Reviewers, s \in Subs : RetryStart(r, s))
    /\ \A r \in Reviewers :
          /\ SF_vars(ReadOk(r))
          /\ WF_vars(WriteBundle(r)) /\ WF_vars(WriteManifest(r))
          /\ WF_vars(WritePage(r)) /\ WF_vars(WriteFiles(r))
          /\ WF_vars(MarkPublished(r)) /\ WF_vars(Decide(r)) /\ WF_vars(Cleanup(r))

Spec == Init /\ [][Next]_vars

LiveSpec == Spec /\ Fairness

\* Reviewers are interchangeable requests; TLC explores one ordering of their names.
ReviewerSymmetry == Permutations(Reviewers)

=============================================================================
