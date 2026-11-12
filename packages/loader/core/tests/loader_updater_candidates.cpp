#include <cassert>
#include <stdexcept>
#include <string>

#include "LoaderFiles.h"
#include "bundle_test_server.h"

namespace {
const std::string kBase     = "https://builds.unbound.rip/";
const std::string kBundle   = "unbound.98.bundle";
const std::string kManifest = R"({"bytecodeVersions":[98]})";

void publishUnkeyed(bundle_test::Server &server, const std::string &contents)
{
    server.files[kBase + "manifest.json"] = kManifest;
    server.files[kBase + kBundle]         = contents;
}

loader::BundleUpdater installTwice(bundle_test::Server &server)
{
    loader::BundleUpdater updater = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "good");
    assert(server.install(updater, std::nullopt));
    publishUnkeyed(server, "bad");
    assert(server.install(updater, std::nullopt));
    assert(server.activeContents() == "bad");
    assert(loader::readTextFile(server.active() + ".previous") == "good");
    return updater;
}

std::string storedEtag(const bundle_test::Server &server)
{
    return server.settings.getString("unbound", "loader.update.etag", "unset");
}

bool candidateFilesGone(const bundle_test::Server &server)
{
    for (const char *suffix : {"", ".etag", ".attempting", loader::kBundleTrustSuffix})
    {
        if (loader::fileExists(server.candidate() + suffix))
        {
            return false;
        }
    }
    return true;
}

void interruptedPromotionRestoresTheReplacedBundle()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = installTwice(server);
    assert(!storedEtag(server).empty());

    assert(loader::writeTextFileAtomically(server.candidate() + ".promoting", "1"));
    assert(updater.resolveBundlePath() == server.active());
    assert(server.activeContents() == "good");
    assert(!loader::fileExists(server.candidate() + ".promoting"));
    assert(!loader::fileExists(server.active() + loader::kBundleTrustSuffix));
    assert(storedEtag(server).empty());
}

void interruptedPromotionWithItsCandidateDiscardsTheCandidate()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = installTwice(server);
    publishUnkeyed(server, "next");
    assert(server.download(updater, std::nullopt));

    assert(loader::writeTextFileAtomically(server.candidate() + ".promoting", "1"));
    assert(updater.resolveBundlePath() == server.active());
    assert(server.activeContents() == "bad");
    assert(candidateFilesGone(server));
    assert(storedEtag(server).empty());
}

void invalidPromotionMarkerStopsTheLaunch()
{
    for (const char *marker : {"", "2", "yes"})
    {
        bundle_test::Server   server;
        loader::BundleUpdater updater = installTwice(server);
        assert(loader::writeTextFileAtomically(server.candidate() + ".promoting", marker));

        bool threw = false;
        try
        {
            updater.resolveBundlePath();
        }
        catch (const std::runtime_error &)
        {
            threw = true;
        }
        assert(threw);
        assert(server.activeContents() == "bad");
    }
}

void attemptedCandidateIsDiscardedWithItsFiles()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "good");
    assert(server.install(updater, std::nullopt));
    publishUnkeyed(server, "crashy");
    assert(server.download(updater, std::nullopt));
    assert(loader::fileExists(server.candidate() + ".etag"));
    assert(loader::fileExists(server.candidate() + loader::kBundleTrustSuffix));

    assert(updater.markBundleAttempted(server.candidate()));
    assert(loader::readTextFile(server.candidate() + ".attempting") == "1");
    assert(updater.resolveBundlePath() == server.active());
    assert(candidateFilesGone(server));
    assert(server.activeContents() == "good");
}

void candidateWithoutAnEtagIsDiscarded()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "good");
    assert(server.install(updater, std::nullopt));
    publishUnkeyed(server, "next");
    assert(server.download(updater, std::nullopt));
    assert(loader::removeFile(server.candidate() + ".etag"));

    assert(updater.resolveBundlePath() == server.active());
    assert(candidateFilesGone(server));
}

void emptyCandidateIsDiscarded()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "good");
    assert(server.install(updater, std::nullopt));
    publishUnkeyed(server, "next");
    assert(server.download(updater, std::nullopt));
    assert(loader::writeTextFileAtomically(server.candidate(), ""));

    assert(updater.resolveBundlePath() == server.active());
    assert(candidateFilesGone(server));
}

void candidateWithoutARecordIsDiscarded()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "next");
    assert(server.download(updater, std::nullopt));
    assert(loader::writeTextFileAtomically(server.candidate() + loader::kBundleTrustSuffix,
                                           "[\"not\",\"a\",\"record\"]"));

    assert(updater.resolveBundlePath() == server.active());
    assert(candidateFilesGone(server));
}

void exemptionThatNoLongerAppliesDiscardsTheCandidate()
{
    bundle_test::Server   server;
    loader::BundleUpdater unkeyed = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "next");
    assert(server.download(unkeyed, std::nullopt));

    loader::BundleUpdater keyed = server.updater(bundle_test::productionTrust());
    assert(keyed.resolveBundlePath() == server.active());
    assert(candidateFilesGone(server));
}

void resolvesTheFirstBundleThatExists()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(loader::BundleTrust{});
    assert(updater.resolveBundlePath() == server.path("unbound.bundle"));

    assert(loader::writeTextFileAtomically(server.path("unbound.js"), "js"));
    assert(updater.resolveBundlePath() == server.path("unbound.js"));

    assert(loader::writeTextFileAtomically(server.active(), "bundle"));
    assert(updater.resolveBundlePath() == server.active());
}

void promotingAJsBundleRemovesTheOtherExtension()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "bytecode");
    assert(server.install(updater, std::nullopt));
    assert(loader::fileExists(server.active() + loader::kBundleTrustSuffix));

    server.files[kBase + "manifest.json"] = R"({"bytecodeVersions":[96]})";
    server.files[kBase + "unbound.js"]    = "source";
    const std::string jsCandidate = server.path("unbound.js") + loader::kBundleCandidateSuffix;
    assert(updater.downloadBundle(updater.resolveBundlePath(), std::nullopt, 98) == jsCandidate);
    assert(updater.resolveBundlePath() == jsCandidate);

    assert(updater.acceptBundle(jsCandidate));
    assert(loader::readTextFile(server.path("unbound.js")) == "source");
    assert(loader::fileExists(server.path("unbound.js") + loader::kBundleTrustSuffix));
    assert(!loader::fileExists(server.active()));
    assert(!loader::fileExists(server.active() + loader::kBundleTrustSuffix));
    assert(updater.resolveBundlePath() == server.path("unbound.js"));
}

void activeBundlesPassThroughCandidateOperations()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "good");
    assert(server.install(updater, std::nullopt));
    const std::optional<std::string> record =
        loader::readTextFile(server.active() + loader::kBundleTrustSuffix);

    assert(updater.markBundleAttempted(server.active()));
    assert(!loader::fileExists(server.active() + ".attempting"));
    assert(updater.acceptBundle(server.active()));
    updater.rejectBundle(server.active());

    assert(server.activeContents() == "good");
    assert(loader::readTextFile(server.active() + loader::kBundleTrustSuffix) == record);
    assert(updater.resolveBundlePath() == server.active());
}

void promotionMovesTheReplacedRecordToTheBackup()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "good");
    assert(server.install(updater, std::nullopt));
    assert(!loader::fileExists(server.active() + ".previous"));
    assert(!loader::fileExists(server.active() + ".previous" + loader::kBundleTrustSuffix));
    const std::optional<std::string> goodRecord =
        loader::readTextFile(server.active() + loader::kBundleTrustSuffix);
    const std::string goodEtag = storedEtag(server);

    publishUnkeyed(server, "next");
    assert(server.install(updater, std::nullopt));
    assert(loader::readTextFile(server.active() + ".previous" + loader::kBundleTrustSuffix) ==
           goodRecord);
    assert(storedEtag(server) != goodEtag);
    assert(candidateFilesGone(server));
    assert(!loader::fileExists(server.candidate() + ".promoting"));
}

void promotionWithoutAReplacedRecordLeavesNoBackupRecord()
{
    bundle_test::Server server;
    assert(loader::writeTextFileAtomically(server.active(), "pre-signing"));
    assert(loader::writeTextFileAtomically(
        server.active() + ".previous" + loader::kBundleTrustSuffix, "{\"kind\":\"stale\"}"));
    loader::BundleUpdater updater = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "verified");
    assert(server.install(updater, std::nullopt));

    assert(server.activeContents() == "verified");
    assert(loader::readTextFile(server.active() + ".previous") == "pre-signing");
    assert(!loader::fileExists(server.active() + ".previous" + loader::kBundleTrustSuffix));
}

void unsignedPromotionClearsTheBaseline()
{
    bundle_test::Server server;
    server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "signed"}});
    loader::BundleUpdater keyed = server.updater(bundle_test::productionTrust());
    assert(server.install(keyed, std::nullopt));
    assert(keyed.baseline());

    loader::BundleUpdater unkeyed = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "unkeyed");
    assert(server.install(unkeyed, std::nullopt));
    assert(!unkeyed.baseline());
}

void rollBackIgnoresAnEmptyBackup()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(loader::BundleTrust{});
    publishUnkeyed(server, "good");
    assert(server.install(updater, std::nullopt));
    assert(loader::writeTextFileAtomically(server.active() + ".previous", ""));

    assert(!updater.rollBackToPrevious());
    assert(server.activeContents() == "good");
}
}

int main()
{
    interruptedPromotionRestoresTheReplacedBundle();
    interruptedPromotionWithItsCandidateDiscardsTheCandidate();
    invalidPromotionMarkerStopsTheLaunch();
    attemptedCandidateIsDiscardedWithItsFiles();
    candidateWithoutAnEtagIsDiscarded();
    emptyCandidateIsDiscarded();
    candidateWithoutARecordIsDiscarded();
    exemptionThatNoLongerAppliesDiscardsTheCandidate();
    resolvesTheFirstBundleThatExists();
    promotingAJsBundleRemovesTheOtherExtension();
    activeBundlesPassThroughCandidateOperations();
    promotionMovesTheReplacedRecordToTheBackup();
    promotionWithoutAReplacedRecordLeavesNoBackupRecord();
    unsignedPromotionClearsTheBaseline();
    rollBackIgnoresAnEmptyBackup();
    return 0;
}
