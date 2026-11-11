#include <cassert>
#include <string>

#include "LoaderFiles.h"
#include "LoaderLaunchGuard.h"
#include "bundle_test_server.h"

namespace {
const std::string kBase   = "https://builds.unbound.rip/";
const std::string kBundle = "unbound.98.bundle";

void countsLaunchesThatNeverBecameHealthy()
{
    bundle_test::Server server;
    loader::LaunchGuard guard(server.root.string());

    loader::LaunchVerdict first = guard.begin();
    assert(first.failures == 0 && !first.rollBack && !first.enterRecovery);

    loader::LaunchVerdict second = guard.begin();
    assert(second.failures == 1 && !second.rollBack && !second.enterRecovery);

    loader::LaunchVerdict third = guard.begin();
    assert(third.failures == 2 && third.rollBack && !third.enterRecovery);

    loader::LaunchVerdict fourth = guard.begin();
    assert(fourth.failures == 3 && !fourth.rollBack && fourth.enterRecovery);

    // Recovery Mode is turned on once, not on every later failure.
    loader::LaunchVerdict fifth = guard.begin();
    assert(fifth.failures == 4 && !fifth.rollBack && !fifth.enterRecovery);

    assert(guard.succeed());
    loader::LaunchVerdict healthy = guard.begin();
    assert(healthy.failures == 0);
}

void countsAFrozenLaunchEvenWhenItWasSwipedAway()
{
    bundle_test::Server server;
    loader::LaunchGuard guard(server.root.string());

    assert(!guard.markFrozen());

    guard.begin();
    assert(guard.markFrozen());
    assert(loader::readTextFile(server.path(loader::LaunchGuard::kFile)) ==
           R"({"failures":0,"frozen":true})");

    loader::LaunchVerdict verdict = guard.begin(loader::PreviousExit::Ended);
    assert(verdict.failures == 1);
    assert(loader::readTextFile(server.path(loader::LaunchGuard::kFile)) == R"({"failures":1})");

    loader::LaunchVerdict ended = guard.begin(loader::PreviousExit::Ended);
    assert(ended.failures == 0);
}

void ignoresAnUnreadableMarker()
{
    bundle_test::Server server;
    loader::LaunchGuard guard(server.root.string());
    assert(loader::writeTextFileAtomically(server.path(loader::LaunchGuard::kFile), "{nope"));

    loader::LaunchVerdict verdict = guard.begin();
    assert(verdict.failures == 1);
}

void rollsBackToTheBundleTheLastPromotionReplaced()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    server.publish(kBase, "2026-10-02T00:00:00.000Z", {{kBundle, "good"}});
    assert(server.install(updater, std::nullopt));
    assert(!updater.rollBackToPrevious());
    std::optional<std::string> goodRecord =
        loader::readTextFile(server.active() + loader::kBundleTrustSuffix);
    assert(goodRecord);

    server.publish(kBase, "2026-10-03T00:00:00.000Z", {{kBundle, "bad"}});
    assert(server.install(updater, std::nullopt));
    assert(server.activeContents() == "bad");

    assert(updater.rollBackToPrevious());
    assert(server.activeContents() == "good");
    assert(!loader::fileExists(server.active() + ".previous"));
    assert(loader::readTextFile(server.active() + loader::kBundleTrustSuffix) == goodRecord);

    // The failed bundle's ETag stays, so the next check keeps the rolled-back bundle.
    std::string resolved = updater.resolveBundlePath();
    assert(updater.downloadBundle(resolved, std::nullopt, 98) == server.active());
    assert(server.activeContents() == "good");
    assert(!updater.rollBackToPrevious());
}
}

int main()
{
    countsLaunchesThatNeverBecameHealthy();
    countsAFrozenLaunchEvenWhenItWasSwipedAway();
    ignoresAnUnreadableMarker();
    rollsBackToTheBundleTheLastPromotionReplaced();
    return 0;
}
