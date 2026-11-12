#pragma once

#include <nlohmann/json.hpp>
#include <string>

#include "LoaderLaunchGuard.h"

namespace loader {
enum class BundleState
{
    Active,
    Trial,
    Discarded,
    RolledBack,
};

struct LaunchReport {
    BundleState  bundle       = BundleState::Active;
    int          earlyCloses  = 0;
    bool         recovery     = false;
    PreviousExit previousExit = PreviousExit::Unknown;
};

LaunchReport launchReport();
void         setBundleState(BundleState state);
void         recordLaunchVerdict(int earlyCloses, bool recovery, PreviousExit previousExit);

std::string bundleStateName(BundleState state);
std::string nativeCrashHeadline(const std::string &stack);
std::string describeNativeCrash(const std::string &stack);

nlohmann::json launchReportJSON(const LaunchReport &report, const std::string &nativeCrash);
std::string    launchReportLine(const LaunchReport &report, const std::string &nativeCrash);
}
