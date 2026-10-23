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
    CasOnStatus,           \* decide() WHERE status = 'pending_review' (review.ts:236)
    HashCheck,             \* publishArtifact re-hash check (review.ts:192-196)
    None                   \* model value: no row, no object

Subs     == SubsV1 \cup SubsV2
Versions == {"v1", "v2"}
VersionOf(s) == IF s \in SubsV1 THEN "v1" ELSE "v2"
Evil     == "evil"         \* bytes the author re-PUT through the still-valid upload URL
Bytes    == Subs \cup {Evil} \* value s = the honest bundle of submission s
Open     == {"awaiting_upload", "pending_review", "changes_requested"} \* OPEN_SUBMISSION_STATUSES
Decisions == {"approved", "rejected", "changes_requested"}

VARIABLES
    status,         \* submission.status
    kind,           \* submission.kind
    staged,         \* staging bucket object at submission.stagingKey
    recordedSha,    \* submission.sha256 (set by finalize)
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

\* createSubmission -> reserve(), one immediate transaction (submissions.ts:121-252, 294-297).
\* Update: addon exists (130), version not live (147-163), open < cap (187).
\* Listing: no open submission claims the id (194; submission_listing_claim_uidx).
Create(s) ==
    /\ status[s] = None
    /\ IF addonExists
          THEN /\ versionRow[VersionOf(s)] = None
               /\ Cardinality(OpenSubs) < MaxPendingUpdates
               /\ kind' = [kind EXCEPT ![s] = "update"]
          ELSE /\ OpenSubs = {}
               /\ kind' = [kind EXCEPT ![s] = "listing"]
    /\ status' = [status EXCEPT ![s] = "awaiting_upload"]
    /\ UNCHANGED <<staged, recordedSha, StoreVars, ReviewerVars>>

\* PUT to the presigned URL (storage.ts:65). It stays reusable until expiry, so the author may
\* overwrite the object at any time, also after finalize or after a delete.
Put(s, b) ==
    /\ status[s] # None
    /\ b \in {s, Evil}
    /\ staged' = [staged EXCEPT ![s] = b]
    /\ UNCHANGED <<status, kind, recordedSha, StoreVars, ReviewerVars>>

\* finalizeSubmission (submissions.ts:335-393): object exists (354), hash (380), CAS on awaiting_upload (385).
\* Hash read and CAS are separate awaits; a Put or Expire between them is equivalent to one
\* before or after this step, because publish re-checks the hash and the CAS re-checks status.
Finalize(s) ==
    /\ status[s] = "awaiting_upload"
    /\ staged[s] # None
    /\ status' = [status EXCEPT ![s] = "pending_review"]
    /\ recordedSha' = [recordedSha EXCEPT ![s] = staged[s]]
    /\ UNCHANGED <<kind, staged, StoreVars, ReviewerVars>>

\* sweepStaging -> expireReservations (staging.ts:25-44).
Expire(s) ==
    /\ status[s] = "awaiting_upload"
    /\ status' = [status EXCEPT ![s] = "expired"]
    /\ staged' = [staged EXCEPT ![s] = None]
    /\ UNCHANGED <<kind, recordedSha, StoreVars, ReviewerVars>>

\* purgeUserSubmissions on ban (staging.ts:126-145, auth.ts:100): cancels any open submission,
\* pending_review too. reserve()'s supersede (submissions.ts:223-228, 300) moves the author's own
\* awaiting_upload/changes_requested row out of Open and deletes its bundle: Purge then Create.
Purge(s) ==
    /\ status[s] \in Open
    /\ status' = [status EXCEPT ![s] = "cancelled"]
    /\ staged' = [staged EXCEPT ![s] = None]
    /\ UNCHANGED <<kind, recordedSha, StoreVars, ReviewerVars>>

\* sweepStaging -> deleteOrphans (staging.ts:46-81): deletes a staged object no open submission owns.
Orphan(s) ==
    /\ status[s] \notin Open
    /\ staged[s] # None
    /\ staged' = [staged EXCEPT ![s] = None]
    /\ UNCHANGED <<status, kind, recordedSha, StoreVars, ReviewerVars>>

(* ---------------- reviewSubmission (review.ts:309-331) ---------------- *)

\* requirePendingReview (review.ts:147-178): reads the row (156), status check at 164.
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

\* publishArtifact read (review.ts:182-201): exists + bytes + re-hash. A missing or changed
\* object throws artifact_mismatch and the request ends.
ReadStaged(r) ==
    LET s == target[r] IN
    /\ pc[r] = "read"
    /\ IF staged[s] = None \/ (HashCheck /\ staged[s] # rowSha[r])
          THEN Done(r)
          ELSE /\ bytes' = [bytes EXCEPT ![r] = staged[s]]
               /\ pc' = [pc EXCEPT ![r] = IF PublishAfterCommit THEN "decide" ELSE "write"]
               /\ UNCHANGED <<target, dec, rowSha, wroteB, wroteM>>
    /\ UNCHANGED <<status, kind, staged, recordedSha, StoreVars>>

AfterWrite == IF PublishAfterCommit THEN "cleanup" ELSE "decide"

\* publishArtifact writes (review.ts:205-210): bundle and manifest, two independent PUTs.
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

\* decide (review.ts:219-294): one immediate transaction. CAS at 236, throw at 240-245.
\* Approval inserts addon (252, PK id) for a listing and addon_version (282, PK addonId+version);
\* a conflict throws and rolls the whole transaction back.
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

\* review.ts:326-328: approve and reject delete the staged bundle; changes_requested keeps it.
Cleanup(r) ==
    LET s == target[r] IN
    /\ pc[r] = "cleanup"
    /\ staged' = IF dec[r] = "changes_requested" THEN staged ELSE [staged EXCEPT ![s] = None]
    /\ Done(r)
    /\ UNCHANGED <<status, kind, recordedSha, StoreVars>>

Next ==
    \/ \E s \in Subs : Create(s) \/ Finalize(s) \/ Expire(s) \/ Purge(s) \/ Orphan(s)
    \/ \E s \in Subs, b \in Bytes : Put(s, b)
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

\* A live version's sha256 is the one finalize recorded, i.e. the bytes reviewers were shown.
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
