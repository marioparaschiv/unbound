#include <cassert>
#include <filesystem>
#include <string>

#include "LoaderFiles.h"
#include "LoaderSystemExits.h"

namespace exits = loader::system_exits;

namespace {
const char *kMetrics = R"({
  "timeStampEnd": "2026-11-12 23:59:00",
  "applicationExitMetrics": {
    "foregroundExitData": {
      "cumulativeMemoryResourceLimitExitCount": 2,
      "cumulativeAppWatchdogExitCount": 1,
      "cumulativeNormalAppExitCount": 9
    },
    "backgroundExitData": {
      "cumulativeMemoryResourceLimitExitCount": 1,
      "cumulativeMemoryPressureExitCount": 30,
      "cumulativeSuspendedWithLockedFileExitCount": 1
    }
  }
})";

const char *kDiagnostics = R"({
  "timeStampEnd": "2026-11-12 23:59:00",
  "hangDiagnostics": [
    {"diagnosticMetaData": {"hangDuration": "3.5 sec"}},
    {"diagnosticMetaData": {"hangDuration": "1,200 ms"}}
  ]
})";

std::string documents()
{
    std::filesystem::path root = std::filesystem::temp_directory_path() / "unbound-system-exits";
    std::filesystem::remove_all(root);
    std::filesystem::create_directories(root);
    return root.string();
}

int64_t dayAfter()
{
    return exits::parseMetricKitTimestamp("2026-11-13 12:00:00");
}

void parsesMetricKitValues()
{
    assert(exits::parseMetricKitTimestamp("1970-01-02 00:00:00") == 86'400'000);
    assert(exits::parseMetricKitTimestamp("garbage") == 0);
    assert(exits::parseMetricKitDuration("3.5 sec") == 3500);
    assert(exits::parseMetricKitDuration("1,200 ms") == 1200);
    assert(exits::parseMetricKitDuration("2 min") == 120000);
    assert(exits::parseMetricKitDuration("") == 0);
}

void summarisesMetricsAndHangsOnce()
{
    std::string directory = documents();
    exits::recordMetricKitMetrics(directory, kMetrics);
    exits::recordMetricKitMetrics(directory, kMetrics);
    exits::recordMetricKitDiagnostics(directory, kDiagnostics);
    exits::recordMetricKitDiagnostics(directory, kDiagnostics);

    nlohmann::json summary = exits::summary(directory, dayAfter());
    assert(summary["memory"] == 3);
    assert(summary["watchdog"] == 1);
    assert(summary["lockedFile"] == 1);
    assert(summary["hangs"] == 2);
    assert(summary["longestHangMs"] == 3500);
    assert(!summary.contains("cpu"));
}

void forgetsOldExits()
{
    std::string directory = documents();
    exits::recordMetricKitMetrics(directory, kMetrics);
    assert(exits::summary(directory, dayAfter() + exits::kSummaryWindowMs).empty());
}

void recordsPlatformExitsByKey()
{
    std::string directory = documents();
    exits::recordExit(directory, "android:1", exits::ExitKind::Memory, dayAfter());
    exits::recordExit(directory, "android:1", exits::ExitKind::Memory, dayAfter());
    exits::recordExit(directory, "android:2", exits::ExitKind::Watchdog, dayAfter());
    nlohmann::json summary = exits::summary(directory, dayAfter());
    assert(summary["memory"] == 1);
    assert(summary["watchdog"] == 1);
}
}

int main()
{
    parsesMetricKitValues();
    summarisesMetricsAndHangsOnce();
    forgetsOldExits();
    recordsPlatformExitsByKey();
    return 0;
}
