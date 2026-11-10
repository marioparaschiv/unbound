------------------------ MODULE ReviewPublishProperties ------------------------
(***************************************************************************)
(* The properties TLC checks over ReviewPublish. Every config runs this    *)
(* module, which inherits Spec, LiveSpec and ReviewerSymmetry.            *)
(***************************************************************************)
EXTENDS ReviewPublish

NoStrayFiles ==
    \A v \in Versions :
        (publicBundle[v] # None \/ publicManifest[v] # None \/ publicPage[v] # None
            \/ publicFiles[v] # None) =>
            versionRow[v] # None

\* Public files for a version exist only once that version is live (an addon_version row).
PublicOnlyIfLive == NoStrayFiles

\* The same, checked only when no review request is in flight: files that stay public for good.
PublicOnlyIfLiveAtRest == (\A r \in Reviewers : pc[r] = "idle") => NoStrayFiles

\* Public bytes are the bytes whose sha256 the live row records; the manifest, store page and extra files
\* are that row's.
PublicMatchesLive ==
    \A v \in Versions : versionRow[v] # None =>
        /\ publicBundle[v] # None => publicBundle[v].bytes = versionRow[v].sha
        /\ publicManifest[v] # None => publicManifest[v] = versionRow[v].sub
        /\ publicPage[v] # None => publicPage[v] = versionRow[v].sub
        /\ publicFiles[v] # None => publicFiles[v] = versionRow[v].sub

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
        /\ publicPage[v] # None => status[publicPage[v]] # "rejected"
        /\ publicFiles[v] # None => status[publicFiles[v]] # "rejected"

\* Every live version eventually has all its public files. Checked with LiveSpec (fair retries, at most
\* MaxWriteFailures failed writes, no Tamper); fails when Recovery is FALSE.
FilesPublic(v) ==
    /\ publicBundle[v] # None /\ publicManifest[v] # None
    /\ publicPage[v] # None /\ publicFiles[v] # None

LiveEventuallyPublic == \A v \in Versions : (versionRow[v] # None) ~> FilesPublic(v)

\* findUpdates and the listings offer a version (live-versions.ts LIVE_VERSIONS): a live row whose files
\* are written, or any live row when ServeOnlyPublished is FALSE.
Served(v) == versionRow[v] # None /\ ~(ServeOnlyPublished /\ pending[v])

\* A version clients are offered has all its public files, so its bundle URL never answers 404.
ServedHasFiles == \A v \in Versions : Served(v) => FilesPublic(v)

=============================================================================
