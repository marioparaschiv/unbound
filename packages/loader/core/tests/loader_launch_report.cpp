#include <cassert>
#include <csignal>
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
}

int main()
{
    checkNativeCrashes();
    checkReport();
    checkState();
    return 0;
}
