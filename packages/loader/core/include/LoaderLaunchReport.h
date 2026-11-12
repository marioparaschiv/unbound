#pragma once

#include <cstdint>
#include <nlohmann/json.hpp>
#include <string>
#include <vector>

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
    std::string  revision;
    std::string  channel;
    int64_t      bundleMs      = 0;
    int64_t      firstRenderMs = 0;
    std::string  source;
    int          pullRequest = 0;
    int64_t      checkedAt   = 0;
    std::string  checkOutcome;
    std::string  checkDetail;
    std::string  settingsRecovery;
};

struct NativeCrashRecord {
    int64_t     at = 0;
    std::string crash;
};

LaunchReport launchReport();
void         setBundleState(BundleState state);
void         recordLaunchVerdict(int earlyCloses, bool recovery, PreviousExit previousExit);
void         setRunningBundle(const std::string &revision, const std::string &channel);
void         recordLaunchTiming(int64_t bundleMs, int64_t firstRenderMs);
void         setBundleSource(const std::string &source, int pullRequest);
void recordUpdateCheck(int64_t at, const std::string &outcome, const std::string &detail = "");
void recordSettingsRecovery(const std::string &recovery);

std::string bundleSourceOf(const std::string &updateURL, bool development);
int         pullRequestOf(const std::string &updateURL);

constexpr const char *kCrashHistoryFile  = "crash-history.json";
constexpr size_t      kCrashHistoryLimit = 5;

std::vector<NativeCrashRecord> readCrashHistory(const std::string &directory);
bool recordCrash(const std::string &directory, const std::string &stack, int64_t at);

std::string bundleStateName(BundleState state);
std::string nativeCrashHeadline(const std::string &stack);
std::string describeNativeCrash(const std::string &stack);

nlohmann::json launchReportJSON(const LaunchReport &report, const std::string &nativeCrash,
                                const std::vector<NativeCrashRecord> &history = {});
std::string    launchReportLine(const LaunchReport &report, const std::string &nativeCrash);
}
