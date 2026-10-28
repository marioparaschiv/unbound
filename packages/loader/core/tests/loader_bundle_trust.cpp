#include <cassert>
#include <string>

#include "bundle_test_server.h"

using bundle_test::Server;
using bundle_test::Signer;

static const std::string kBase    = "https://builds.unbound.rip/";
static const std::string kOther   = "https://cdn.example.com/unbound/pr/42/";
static const std::string kDev     = "http://10.0.2.2:3000/";
static const std::string kOlder   = "2026-10-01T00:00:00.000Z";
static const std::string kCurrent = "2026-10-02T00:00:00.000Z";
static const std::string kNewer   = "2026-10-03T00:00:00.000Z";
static const std::string kBundle  = "unbound.98.bundle";

static nlohmann::json trustRecord(const std::string &path)
{
    return nlohmann::json::parse(loader::readTextFile(path + loader::kBundleTrustSuffix).value());
}

static void acceptsASignedManifestAndBundle()
{
    Server server;
    server.publish(kBase, kCurrent, {{kBundle, "current"}, {"unbound.js", "js"}});
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());

    assert(server.download(updater, std::nullopt));
    assert(server.lastDownload == kBase + kBundle);
    assert(trustRecord(server.candidate())["kind"] == "manifest");
    assert(updater.resolveBundlePath() == server.candidate());
    assert(updater.markBundleAttempted(server.candidate()));
    assert(updater.acceptBundle(server.candidate()));

    assert(server.activeContents() == "current");
    assert(trustRecord(server.active())["kind"] == "manifest");
    std::optional<loader::BundleBaseline> baseline = updater.baseline();
    assert(baseline && baseline->source == kBase && baseline->channel == "beta");
    assert(baseline->buildTime == kCurrent && baseline->revision == "abc1234");

    assert(!server.download(updater, std::nullopt));
    assert(server.lastHeaders.count("If-None-Match") == 1);
}

static void rejectsABundleWhoseHashDoesNotMatch()
{
    Server server;
    server.publish(kBase, kCurrent, {{kBundle, "current"}});
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    assert(server.install(updater, std::nullopt));

    server.publish(kBase, kNewer, {{kBundle, "next"}});
    server.files[kBase + kBundle] = "tampered";
    assert(!server.download(updater, std::nullopt));
    assert(!loader::fileExists(server.candidate()));
    assert(!loader::fileExists(server.candidate() + loader::kBundleTrustSuffix));
    assert(updater.resolveBundlePath() == server.active());
    assert(server.activeContents() == "current");
}

static void rejectsManifestsSignedByOtherKeys()
{
    Server server;
    server.publish(kBase, kCurrent, {{kBundle, "foreign"}}, Signer{&bundle_test::foreignKey()});
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    assert(!server.download(updater, std::nullopt));

    server.publish(kOther, kCurrent, {{kBundle, "pr"}}, Signer{&bundle_test::pullRequestKey(), 42});
    assert(!server.download(updater, kOther));
}

static void refusesOlderManifests()
{
    Server server;
    server.publish(kBase, kCurrent, {{kBundle, "current"}});
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    assert(server.install(updater, std::nullopt));

    server.publish(kBase, kOlder, {{kBundle, "older"}});
    assert(!server.download(updater, std::nullopt));
    assert(!loader::fileExists(server.candidate()));

    server.publish(kBase, kNewer, {{kBundle, "older"}}, {}, "stable");
    assert(!server.download(updater, std::nullopt));

    server.publish(kBase, kCurrent, {{kBundle, "rebuilt"}});
    assert(server.download(updater, std::nullopt));
    updater.rejectBundle(server.candidate());

    server.publish(kBase, kNewer, {{kBundle, "newer"}});
    assert(server.install(updater, std::nullopt));
    assert(server.activeContents() == "newer");
    assert(updater.baseline()->buildTime == kNewer);
}

static void refusesUnsignedManifestsOnceABaselineExists()
{
    Server server;
    server.publish(kBase, kCurrent, {{kBundle, "current"}});
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    assert(server.install(updater, std::nullopt));

    server.publish(kBase, kOlder, {{kBundle, "older"}});
    server.files.erase(kBase + "manifest.json.sig");
    assert(!server.download(updater, std::nullopt));
    server.files.erase(kBase + "manifest.json");
    assert(!server.download(updater, std::nullopt));
    assert(server.activeContents() == "current");
}

static void refusesBundleSignaturesWithoutASignedManifest()
{
    Server server;
    server.files[kBase + "manifest.json"]  = R"({"bytecodeVersions":[98]})";
    server.files[kBase + kBundle]          = "legacy";
    server.files[kBase + kBundle + ".sig"] = bundle_test::productionKey().sign("legacy");
    loader::BundleUpdater updater          = server.updater(bundle_test::productionTrust());

    assert(!server.download(updater, std::nullopt));
    assert(!loader::fileExists(server.candidate()));

    assert(loader::writeTextFileAtomically(server.candidate(), "legacy"));
    assert(loader::writeTextFileAtomically(
        server.candidate() + loader::kBundleTrustSuffix,
        nlohmann::json{{"kind", "bundle"},
                       {"url", kBase + kBundle},
                       {"source", kBase},
                       {"file", kBundle},
                       {"signature", bundle_test::productionKey().sign("legacy")}}
            .dump()));
    assert(updater.resolveBundlePath() != server.candidate());
    assert(!loader::fileExists(server.candidate()));
}

static void resetsTheBaselineWhenTheURLChanges()
{
    Server server;
    server.publish(kBase, kCurrent, {{kBundle, "current"}});
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    assert(server.install(updater, std::nullopt));

    server.publish(kOther, kOlder, {{kBundle, "other"}}, {}, "stable");
    assert(server.install(updater, kOther));
    assert(server.activeContents() == "other");
    assert(updater.baseline()->source == kOther && updater.baseline()->buildTime == kOlder);

    server.publish(kBase, kOlder, {{kBundle, "back"}});
    assert(server.install(updater, std::nullopt));
    assert(updater.baseline()->source == kBase);
}

static void exemptSourcesSkipTheChecks()
{
    Server server;
    server.publish(kBase, kCurrent, {{kBundle, "current"}});
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    assert(server.install(updater, std::nullopt));

    server.files[kDev + "manifest.json"] = R"({"bytecodeVersions":[98]})";
    server.files[kDev + kBundle]         = "dev";
    assert(server.install(updater, kDev));
    assert(trustRecord(server.active())["exemption"] == "development");
    assert(!updater.baseline());

    server.publish(kBase, kCurrent, {{kBundle, "current"}});
    assert(server.install(updater, std::nullopt));
    server.publish(kBase, kOlder, {{kBundle, "unsigned"}}, Signer{&bundle_test::foreignKey()});
    server.settings.set("unbound", "loader.update.unsigned", true);
    assert(server.install(updater, std::nullopt));
    assert(server.activeContents() == "unsigned");
    assert(trustRecord(server.active())["exemption"] == "unsigned");
}

static void bindsPullRequestBuildsToTheirNumber()
{
    for (uint32_t build : {0u, 5u, 6u})
    {
        Server                server;
        loader::BundleUpdater updater = server.updater(build ? bundle_test::pullRequestTrust(build)
                                                             : bundle_test::productionTrust());

        auto accepts = [&](const std::string &contents, Signer signer) {
            server.publish(kOther, kCurrent, {{kBundle, contents}}, signer);
            bool accepted = server.download(updater, kOther);
            updater.rejectBundle(server.candidate());
            return accepted;
        };

        assert(accepts("pr 5", Signer{&bundle_test::pullRequestKey(), 5}) == (build == 5));
        assert(!accepts("unbound pr key", Signer{&bundle_test::pullRequestKey(), 0}));
        assert(!accepts("production key with context", Signer{&bundle_test::productionKey(), 5}));
        assert(accepts("production", Signer{}));
    }

    Server server;
    server.publish(kOther, kCurrent, {{kBundle, "pr build"}},
                   Signer{&bundle_test::pullRequestKey(), 5});
    loader::BundleUpdater pr6 = server.updater(bundle_test::pullRequestTrust(6));
    assert(!server.download(pr6, kOther));
    loader::BundleUpdater pr5 = server.updater(bundle_test::pullRequestTrust(5));
    assert(server.download(pr5, kOther));
    loader::BundleUpdater production = server.updater(bundle_test::productionTrust());
    assert(production.resolveBundlePath() == server.active());
    assert(!loader::fileExists(server.candidate()));
}

static void discardsCandidatesAnOlderLoaderDownloaded()
{
    Server server;
    assert(loader::writeTextFileAtomically(server.active(), "active"));
    assert(loader::writeTextFileAtomically(server.candidate(), "unverified"));
    assert(loader::writeTextFileAtomically(server.candidate() + ".etag", "\"old\""));

    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    assert(updater.resolveBundlePath() == server.active());
    assert(!loader::fileExists(server.candidate()));
    assert(!loader::fileExists(server.candidate() + ".etag"));

    server.publish(kBase, kCurrent, {{kBundle, "verified"}});
    assert(server.install(updater, std::nullopt));
    assert(server.activeContents() == "verified");
}

static void reverifiesCandidatesBeforeRunningAndPromoting()
{
    Server server;
    server.publish(kBase, kCurrent, {{kBundle, "current"}});
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    assert(server.install(updater, std::nullopt));

    server.publish(kBase, kNewer, {{kBundle, "next"}});
    assert(server.download(updater, std::nullopt));
    assert(loader::writeTextFileAtomically(server.candidate(), "swapped"));
    assert(updater.resolveBundlePath() == server.active());
    assert(!loader::fileExists(server.candidate()));

    assert(server.download(updater, std::nullopt));
    assert(updater.resolveBundlePath() == server.candidate());
    assert(loader::removeFile(server.candidate() + loader::kBundleTrustSuffix));
    assert(!updater.acceptBundle(server.candidate()));
    assert(!loader::fileExists(server.candidate()));
    assert(server.activeContents() == "current");

    server.settings.set("unbound", "loader.update.unsigned", true);
    server.files[kBase + kBundle] = "unsigned";
    assert(server.download(updater, std::nullopt));
    server.settings.set("unbound", "loader.update.unsigned", false);
    assert(updater.resolveBundlePath() == server.active());
    assert(!loader::fileExists(server.candidate()));
}

static void rejectsCandidatesAnotherKeyOrBuildVerified()
{
    Server server;
    server.publish(kOther, kCurrent, {{kBundle, "pr"}}, Signer{&bundle_test::pullRequestKey(), 5});
    loader::BundleUpdater pr5 = server.updater(bundle_test::pullRequestTrust(5));
    assert(server.download(pr5, kOther));

    loader::BundleUpdater production = server.updater(bundle_test::productionTrust());
    assert(production.resolveBundlePath() == server.active());
    assert(!loader::fileExists(server.candidate()));
}

static void replacesAPreSigningActiveBundle()
{
    Server server;
    assert(loader::writeTextFileAtomically(server.active(), "pre-signing"));
    server.publish(kBase, kCurrent, {{kBundle, "verified"}});
    std::string etag = "\"" + loader::sha512Hex("verified").substr(0, 16) + "\"";
    server.settings.set("unbound", "loader.update.etag", etag);

    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    assert(updater.resolveBundlePath() == server.active());
    assert(server.download(updater, std::nullopt));
    assert(server.lastHeaders.empty());
    assert(server.activeContents() == "pre-signing");

    assert(updater.acceptBundle(updater.resolveBundlePath()));
    assert(server.activeContents() == "verified");
    assert(loader::fileExists(server.active() + loader::kBundleTrustSuffix));

    try
    {
        updater.downloadBundle(updater.resolveBundlePath(), std::nullopt, 98);
    }
    catch (const std::runtime_error &)
    {
    }
    assert(server.lastHeaders.count("If-None-Match") == 1);

    server.files.clear();
    assert(!server.download(updater, std::nullopt));
    assert(updater.resolveBundlePath() == server.active());
}

static void forgetsTheTrustRecordOfAnInterruptedPromotion()
{
    Server server;
    server.publish(kBase, kCurrent, {{kBundle, "current"}});
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    assert(server.install(updater, std::nullopt));

    assert(loader::writeTextFileAtomically(server.candidate() + ".promoting", "0"));
    assert(updater.resolveBundlePath() == server.active());
    assert(!loader::fileExists(server.active() + loader::kBundleTrustSuffix));
}

static void skipsChecksWithoutAKey()
{
    Server server;
    server.files[kBase + "manifest.json"] = R"({"bytecodeVersions":[98]})";
    server.files[kBase + kBundle]         = "unkeyed";
    loader::BundleUpdater updater         = server.updater(loader::BundleTrust{});
    assert(server.install(updater, std::nullopt));
    assert(trustRecord(server.active())["exemption"] == "unkeyed");
}

int main()
{
    acceptsASignedManifestAndBundle();
    rejectsABundleWhoseHashDoesNotMatch();
    rejectsManifestsSignedByOtherKeys();
    refusesOlderManifests();
    refusesUnsignedManifestsOnceABaselineExists();
    refusesBundleSignaturesWithoutASignedManifest();
    resetsTheBaselineWhenTheURLChanges();
    exemptSourcesSkipTheChecks();
    bindsPullRequestBuildsToTheirNumber();
    discardsCandidatesAnOlderLoaderDownloaded();
    reverifiesCandidatesBeforeRunningAndPromoting();
    rejectsCandidatesAnotherKeyOrBuildVerified();
    replacesAPreSigningActiveBundle();
    forgetsTheTrustRecordOfAnInterruptedPromotion();
    skipsChecksWithoutAKey();
    return 0;
}
