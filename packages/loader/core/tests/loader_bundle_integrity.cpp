#include <cassert>
#include <string>

#include "LoaderFiles.h"
#include "bundle_test_server.h"

namespace {
const std::string kBase   = "https://builds.unbound.rip/";
const std::string kBundle = "unbound.98.bundle";

void trustsAnUnchangedInstalledBundle()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    server.publish(kBase, "2026-11-13T00:00:00.000Z", {{kBundle, "good"}});
    assert(server.install(updater, std::nullopt));

    assert(!updater.integrityProblem(server.active()));
    assert(!updater.integrityProblem(server.active()));
}

void healsABundleWhoseBytesChanged()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    server.publish(kBase, "2026-11-13T00:00:00.000Z", {{kBundle, "good"}});
    assert(server.install(updater, std::nullopt));
    assert(loader::writeTextFileAtomically(server.active(), "goo!"));

    std::optional<std::string> problem = updater.integrityProblem(server.active());
    assert(problem && problem->find("SHA-512") != std::string::npos);

    updater.healDamagedBundle(server.active());
    assert(!loader::fileExists(server.active()));
    assert(!loader::fileExists(server.active() + loader::kBundleTrustSuffix));

    assert(server.install(updater, std::nullopt));
    assert(server.activeContents() == "good");
    assert(!updater.integrityProblem(server.active()));
}

void reportsAnEmptyBundle()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    server.publish(kBase, "2026-11-13T00:00:00.000Z", {{kBundle, "good"}});
    assert(server.install(updater, std::nullopt));
    assert(loader::writeTextFileAtomically(server.active(), ""));

    assert(updater.integrityProblem(server.active()) == std::string("it is empty"));
}
}

int main()
{
    trustsAnUnchangedInstalledBundle();
    healsABundleWhoseBytesChanged();
    reportsAnEmptyBundle();
    return 0;
}
