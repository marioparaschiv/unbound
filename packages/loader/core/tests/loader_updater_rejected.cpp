#include <cassert>
#include <string>

#include "LoaderPreferences.h"
#include "bundle_test_server.h"

using bundle_test::Server;

static const std::string kBase   = "https://builds.unbound.rip/";
static const std::string kBundle = "unbound.98.bundle";

static void installGoodThenTryCrashy(Server &server, loader::BundleUpdater &updater)
{
    server.publish(kBase, "2026-10-01T00:00:00.000Z", {{kBundle, "good"}}, {}, "beta", "good111");
    assert(server.install(updater, std::nullopt));
    server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "crashy"}}, {}, "beta", "bad2222");
    assert(server.download(updater, std::nullopt));
    assert(updater.markBundleAttempted(server.candidate()));
    assert(updater.resolveBundlePath() == server.active());
}

static void skipsTheBuildThatFailedUntilANewerOneShips()
{
    Server                server;
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    installGoodThenTryCrashy(server, updater);
    assert(loader::preferences::rejectedRevision(server.settings) == "bad2222");

    int downloads = server.downloads;
    assert(!server.download(updater, std::nullopt));
    assert(server.downloads == downloads);
    assert(server.activeContents() == "good");

    server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "fixed"}}, {}, "beta", "fix3333");
    assert(server.download(updater, std::nullopt));
}

static void aForcedUpdateStillFetchesTheFailedBuild()
{
    Server                server;
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    installGoodThenTryCrashy(server, updater);

    server.settings.set("unbound", "loader.update.force", true);
    assert(server.download(updater, std::nullopt));
}

int main()
{
    skipsTheBuildThatFailedUntilANewerOneShips();
    aForcedUpdateStillFetchesTheFailedBuild();
    return 0;
}
