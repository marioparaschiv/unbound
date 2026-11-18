#include <cassert>
#include <cstdlib>
#include <ctime>
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

const char *kHangWithStack = R"({
  "timeStampEnd": "2026-11-12 23:00:00",
  "hangDiagnostics": [
    {
      "diagnosticMetaData": {"hangDuration": "4 sec"},
      "callStackTree": {"callStacks": [{
        "threadAttributed": true,
        "callStackRootFrames": [{
          "address": 4096, "binaryName": "Unbound.dylib", "offsetIntoBinaryTextSegment": 16,
          "subFrames": [{"address": 8192, "binaryName": "Discord", "offsetIntoBinaryTextSegment": 32}]
        }]
      }]}
    }
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
    setenv("TZ", "CET-1", 1);
    tzset();
    assert(exits::parseMetricKitTimestamp("1970-01-02 01:00:00") == 86'400'000);
    setenv("TZ", "UTC0", 1);
    tzset();
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

void keepsTheLatestHangsStack()
{
    std::string directory = documents();
    exits::recordMetricKitDiagnostics(directory, kDiagnostics);
    exits::recordMetricKitDiagnostics(directory, kHangWithStack);

    nlohmann::json last = exits::summary(directory, dayAfter())["lastHang"];
    assert(last["ms"] == 4000);
    assert(last["stack"]
           == "Hang 4 sec\n#0 0x1000 Unbound.dylib + 0x10\n#1 0x2000 Discord + 0x20\n");
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

void namesThePluginsThatFroze()
{
    std::string directory = documents();
    exits::recordFreeze(directory, "Message Logger", dayAfter(), 6100);
    exits::recordFreeze(directory, "Clean Channel Names", dayAfter(), 7000);
    exits::recordFreeze(directory, "Clean Channel Names", dayAfter(), 8200);
    exits::recordFreeze(directory, "", dayAfter(), 9000);
    nlohmann::json summary = exits::summary(directory, dayAfter());
    nlohmann::json freezes = summary["freezes"];
    assert(freezes.size() == 2);
    assert(freezes[0]["name"] == "Clean Channel Names");
    assert(freezes[0]["count"] == 2);
    assert(freezes[0]["longestMs"] == 8200);
    assert(freezes[1]["name"] == "Message Logger");
    assert(!summary.contains("longestHangMs"));
}
}

int main()
{
    parsesMetricKitValues();
    summarisesMetricsAndHangsOnce();
    keepsTheLatestHangsStack();
    forgetsOldExits();
    recordsPlatformExitsByKey();
    namesThePluginsThatFroze();
    return 0;
}
