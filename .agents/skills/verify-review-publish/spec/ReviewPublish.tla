---------------------------- MODULE ReviewPublish ----------------------------
(***************************************************************************)
(* Addon submission review and publishing in apps/web.                     *)
(* One addon id; each submission targets version "v1" (SubsV1) or "v2"     *)
(* (SubsV2). Line numbers refer to apps/web/src/lib/*.ts at the sync       *)
(* commit recorded in ../SKILL.md.                                         *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS
    SubsV1, SubsV2,        \* submission ids, by the version their manifest names
    Reviewers,             \* concurrent POST /api/v1/submissions/$id/review requests
    MaxPendingUpdates,     \* env SUBMISSION_MAX_PENDING_UPDATES (default 1)
    PublishAfterCommit,    \* FALSE = current code; TRUE = public writes moved after decide()
    CasOnStatus,           \* decide() WHERE status = 'pending_review' (review.ts:281)
    HashCheck,             \* publishArtifact re-hash check (review.ts:206-210)
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
    decisions,      \* committed decide() transactions per submission
    pc, target, dec, rowSha, bytes, wroteB, wroteM \* per review request

vars == <<status, kind, staged, recordedSha, addonExists, versionRow, publicBundle,
          publicManifest, decisions, pc, target, dec, rowSha, bytes, wroteB, wroteM>>

Init ==
    /\ status = [s \in Subs |-> None]
    /\ kind = [s \in Subs |-> None]
    /\ staged = [s \in Subs |-> None]
    /\ recordedSha = [s \in Subs |-> None]
    /\ addonExists = FALSE
    /\ versionRow = [v \in Versions |-> None]
    /\ publicBundle = [v \in Versions |-> None]
    /\ publicManifest = [v \in Versions |-> None]
    /\ decisions = [s \in Subs |-> 0]
    /\ pc = [r \in Reviewers |-> "idle"]
    /\ target = [r \in Reviewers |-> None]
    /\ dec = [r \in Reviewers |-> None]
    /\ rowSha = [r \in Reviewers |-> None]
    /\ bytes = [r \in Reviewers |-> None]
    /\ wroteB = [r \in Reviewers |-> FALSE]
    /\ wroteM = [r \in Reviewers |-> FALSE]

OpenSubs == {o \in Subs : status[o] \in Open}

ReviewerVars == <<pc, target, dec, rowSha, bytes, wroteB, wroteM>>
StoreVars    == <<addonExists, versionRow, publicBundle, publicManifest, decisions>>

(* ---------------- Authors and background jobs ---------------- *)

\* createSubmission -> stageAndReserve (submissions.ts:343-362): the bundle read from the pinned blob
\* is written to staging before the row exists. A refused claim deletes it again, which Orphan covers.
Stage(s) ==
    /\ status[s] = None
    /\ staged' = [staged EXCEPT ![s] = s]
    /\ UNCHANGED <<status, kind, recordedSha, StoreVars, ReviewerVars>>

\* reserve(), one serializable transaction retried whole on a serialization failure (submissions.ts:276-341),
\* inserting the row as pending_review with the sha256 of the bytes read at the pin. Update: addon
\* exists (checkClaim 141, 148), version not live, open < cap (205). Listing: no open submission claims
\* the id (212; submission_listing_claim_uidx).
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
    /\ status[s] # None
    /\ staged' = [staged EXCEPT ![s] = Evil]
    /\ UNCHANGED <<status, kind, recordedSha, StoreVars, ReviewerVars>>

\* purgeUserSubmissions on ban (staging.ts:105-144, auth.ts:109): cancels any open submission,
\* pending_review too. reserve()'s supersede (submissions.ts:288-293, 387) moves the author's own
\* changes_requested row out of Open and deletes its bundle: Purge then Create.
Purge(s) ==
    /\ status[s] \in Open
    /\ status' = [status EXCEPT ![s] = "cancelled"]
    /\ staged' = [staged EXCEPT ![s] = None]
    /\ UNCHANGED <<kind, recordedSha, StoreVars, ReviewerVars>>

\* sweepStaging -> deleteOrphans (staging.ts:24-64): deletes a staged object no open submission owns.
\* Status None over-approximates a create slower than STAGING_ORPHAN_GRACE_SECONDS; approval refetches.
Orphan(s) ==
    /\ status[s] \notin Open
    /\ staged[s] # None
    /\ staged' = [staged EXCEPT ![s] = None]
    /\ UNCHANGED <<status, kind, recordedSha, StoreVars, ReviewerVars>>

(* ---------------- reviewSubmission (review.ts:323-356) ---------------- *)

\* requirePendingReview (review.ts:158-189): reads the row (167), status check at 175.
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
    /\ UNCHANGED <<status, kind, staged, recordedSha, StoreVars>>

Done(r) ==
    /\ pc' = [pc EXCEPT ![r] = "idle"]
    /\ UNCHANGED <<target, dec, rowSha, bytes, wroteB, wroteM>>

Got(r, b) ==
    /\ bytes' = [bytes EXCEPT ![r] = b]
    /\ pc' = [pc EXCEPT ![r] = IF PublishAfterCommit THEN "decide" ELSE "write"]
    /\ UNCHANGED <<target, dec, rowSha, wroteB, wroteM>>

\* publishArtifact read (review.ts:201-215): the staged bytes, or, when the object is gone, the pinned
\* blob read again (refetchBundle 193-199). The blob is content-addressed and readBlob checks its
\* SHA-1, so a refetch yields the honest bytes or fails with github_unavailable. Then the re-hash; a
\* mismatch throws artifact_mismatch and the request ends.
ReadStaged(r) ==
    LET s == target[r] IN
    /\ pc[r] = "read"
    /\ IF staged[s] = None
          THEN Got(r, s) \/ Done(r)
          ELSE IF HashCheck /\ staged[s] # rowSha[r]
                  THEN Done(r)
                  ELSE Got(r, staged[s])
    /\ UNCHANGED <<status, kind, staged, recordedSha, StoreVars>>

AfterWrite == IF PublishAfterCommit THEN "cleanup" ELSE "decide"

\* publishArtifact writes (review.ts:217 -> artifacts.ts writeArtifact 66-71): bundle and manifest, two
\* independent PUTs.
WriteBundle(r) ==
    LET s == target[r] IN
    /\ pc[r] = "write" /\ ~wroteB[r]
    /\ publicBundle' = [publicBundle EXCEPT ![VersionOf(s)] = [from |-> s, bytes |-> bytes[r]]]
    /\ wroteB' = [wroteB EXCEPT ![r] = TRUE]
    /\ pc' = [pc EXCEPT ![r] = IF wroteM[r] THEN AfterWrite ELSE "write"]
    /\ UNCHANGED <<status, kind, staged, recordedSha, addonExists, versionRow, publicManifest,
                   decisions, target, dec, rowSha, bytes, wroteM>>

WriteManifest(r) ==
    LET s == target[r] IN
    /\ pc[r] = "write" /\ ~wroteM[r]
    /\ publicManifest' = [publicManifest EXCEPT ![VersionOf(s)] = s]
    /\ wroteM' = [wroteM EXCEPT ![r] = TRUE]
    /\ pc' = [pc EXCEPT ![r] = IF wroteB[r] THEN AfterWrite ELSE "write"]
    /\ UNCHANGED <<status, kind, staged, recordedSha, addonExists, versionRow, publicBundle,
                   decisions, target, dec, rowSha, bytes, wroteB>>

\* decide (review.ts:265-312): one serializable transaction, retried whole on a serialization failure.
\* CAS at 281, throw at 284-289. Approval runs publishVersion (297), which inserts addon (239, PK id)
\* for a listing and addon_version (253, PK addonId+version); a conflict throws and rolls it all back.
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
                     ELSE UNCHANGED <<versionRow, addonExists>>
               /\ pc' = [pc EXCEPT ![r] =
                        IF d = "approved" /\ PublishAfterCommit THEN "write" ELSE "cleanup"]
               /\ UNCHANGED <<publicBundle, publicManifest, target, dec, rowSha, bytes, wroteB, wroteM>>
    /\ UNCHANGED <<kind, staged, recordedSha>>

\* review.ts:344-346: approve and reject delete the staged bundle; changes_requested keeps it.
Cleanup(r) ==
    LET s == target[r] IN
    /\ pc[r] = "cleanup"
    /\ staged' = IF dec[r] = "changes_requested" THEN staged ELSE [staged EXCEPT ![s] = None]
    /\ Done(r)
    /\ UNCHANGED <<status, kind, recordedSha, StoreVars>>

Next ==
    \/ \E s \in Subs : Stage(s) \/ Create(s) \/ Tamper(s) \/ Purge(s) \/ Orphan(s)
    \/ \E r \in Reviewers, s \in Subs, d \in Decisions : Start(r, s, d)
    \/ \E r \in Reviewers : ReadStaged(r) \/ WriteBundle(r) \/ WriteManifest(r) \/ Decide(r) \/ Cleanup(r)

Spec == Init /\ [][Next]_vars

\* Reviewers are interchangeable requests; TLC explores one ordering of their names.
ReviewerSymmetry == Permutations(Reviewers)

(* ---------------- Properties ---------------- *)

NoStrayFiles ==
    \A v \in Versions :
        (publicBundle[v] # None \/ publicManifest[v] # None) => versionRow[v] # None

\* Public files for a version exist only once that version is live (an addon_version row).
PublicOnlyIfLive == NoStrayFiles

\* The same, checked only when no review request is in flight: files that stay public for good.
PublicOnlyIfLiveAtRest == (\A r \in Reviewers : pc[r] = "idle") => NoStrayFiles

\* Public bytes are the bytes whose sha256 the live row records, and the manifest is that row's.
PublicMatchesLive ==
    \A v \in Versions : versionRow[v] # None =>
        /\ publicBundle[v] # None => publicBundle[v].bytes = versionRow[v].sha
        /\ publicManifest[v] # None => publicManifest[v] = versionRow[v].sub

\* A live version's sha256 is the one create recorded from the pin, i.e. the bytes reviewers were shown.
LiveIsReviewed ==
    \A v \in Versions : versionRow[v] # None =>
        versionRow[v].sha = recordedSha[versionRow[v].sub]

\* decide() commits at most one decision per submission.
DecidedOnce == \A s \in Subs : decisions[s] <= 1

\* What the public bucket serves never comes from a rejected submission.
RejectedNeverPublic ==
    \A v \in Versions :
        /\ publicBundle[v] # None => status[publicBundle[v].from] # "rejected"
        /\ publicManifest[v] # None => status[publicManifest[v]] # "rejected"

=============================================================================
