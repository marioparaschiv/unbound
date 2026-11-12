#include <cassert>
#include <csignal>
#include <filesystem>
#include <string>

#include "LoaderLaunchReport.h"

using namespace loader;

static const std::string kStack = "Signal " + std::to_string(SIGSEGV) +
                                  "\nAddon {\"id\":\"chat-bubbles\",\"name\":\"Chat Bubbles\"}\n"
                                  "#0 0x1 Unbound.dylib + 0x10\n";

static void checkNativeCrashes()
{
    assert(nativeCrashHeadline(kStack) == "SIGSEGV in Chat Bubbles");
    assert(nativeCrashHeadline("Signal " + std::to_string(SIGABRT) + "\n#0 0x1\n") == "SIGABRT");
    assert(nativeCrashHeadline("").empty());
    assert(nativeCrashHeadline("garbage").empty());
    assert(describeNativeCrash(kStack).find("Addon Chat Bubbles\n") != std::string::npos);
    assert(describeNativeCrash(kStack).find("{\"id\"") == std::string::npos);
}

static void checkReport()
{
    LaunchReport quiet;
    assert(launchReportLine(quiet, "").empty());
    assert(launchReportJSON(quiet, "")["bundle"] == "active");
    assert(!launchReportJSON(quiet, "").contains("lastCrash"));

    LaunchReport troubled{BundleState::RolledBack, 2, true, PreviousExit::Crashed};
    assert(launchReportLine(troubled, kStack) ==
           "bundle rolled back · recovery mode · 2 early closes · previous launch crashed · last "
           "crash SIGSEGV in Chat Bubbles");
    nlohmann::json json = launchReportJSON(troubled, kStack);
    assert(json["previousExit"] == "crashed");
    assert(json["earlyCloses"] == 2);
    assert(json["lastCrash"] == "SIGSEGV in Chat Bubbles");
}

static void checkState()
{
    setBundleState(BundleState::Trial);
    recordLaunchVerdict(1, false, PreviousExit::Ended);
    LaunchReport report = launchReport();
    assert(report.bundle == BundleState::Trial);
    assert(report.earlyCloses == 1);
    assert(report.previousExit == PreviousExit::Ended);
    recordLaunchTiming(120, 1800);
    assert(launchReportJSON(launchReport(), "")["firstRenderMs"] == 1800);
}

static void checkCrashHistory()
{
    std::filesystem::path root =
        std::filesystem::temp_directory_path() / "unbound-crash-history-test";
    std::filesystem::remove_all(root);
    std::filesystem::create_directories(root);

    assert(readCrashHistory(root.string()).empty());
    assert(!recordCrash(root.string(), "garbage", 1));
    for (int64_t at = 1; at <= 7; at++)
    {
        assert(recordCrash(root.string(), kStack, at));
    }
    std::vector<NativeCrashRecord> history = readCrashHistory(root.string());
    assert(history.size() == kCrashHistoryLimit);
    assert(history.front().at == 3);
    assert(history.back().crash == "SIGSEGV in Chat Bubbles");

    LaunchReport report;
    report.revision     = "abc1234";
    report.channel      = "stable";
    nlohmann::json json = launchReportJSON(report, "", history);
    assert(json["revision"] == "abc1234");
    assert(json["crashes"].size() == kCrashHistoryLimit);
    assert(json["crashes"][0]["at"] == 3);

    std::filesystem::remove_all(root);
}

int main()
{
    checkCrashHistory();
    checkNativeCrashes();
    checkReport();
    checkState();
    return 0;
}
