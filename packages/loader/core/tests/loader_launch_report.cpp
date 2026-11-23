#include <cassert>
#include <csignal>
#include <filesystem>
#include <string>

#include "LoaderCrashHandler.h"
#include "LoaderLaunchReport.h"

using namespace loader;

static const std::string kStack = "Signal " + std::to_string(SIGSEGV)
                                  + "\nAddon {\"id\":\"chat-bubbles\",\"name\":\"Chat Bubbles\"}\n"
                                    "#0 0x1 Unbound.dylib + 0x10\n";

// Mirrors kTrapReason: Apple builds name Swift's trap, other platforms the instruction.
static const std::string kTrapHeadline =
#if defined(__APPLE__)
    "SIGTRAP (Swift runtime check failed)";
#else
    "SIGTRAP (trap instruction)";
#endif

static void checkNativeCrashes()
{
    assert(nativeCrashHeadline(kStack) == "SIGSEGV in Chat Bubbles");
    assert(nativeCrashHeadline("Signal " + std::to_string(SIGSEGV)
                               + "\nImage Unbound.dylib 01234567-89AB-CDEF-0123-456789ABCDEF\n"
                                 "Addon {\"id\":\"x\",\"name\":\"Chat Bubbles\"}\n")
           == "SIGSEGV in Chat Bubbles");
    assert(nativeCrashHeadline("Signal " + std::to_string(SIGABRT) + "\n#0 0x1\n") == "SIGABRT");
    assert(nativeCrashHeadline("Signal " + std::to_string(SIGSEGV)
                               + "\nFault 0x2000000102345678\n"
                                 "Addon {\"id\":\"x\",\"name\":\"Chat Bubbles\"}\n")
           == "SIGSEGV (likely pointer authentication failure) in Chat Bubbles");
    assert(nativeCrashHeadline("Signal " + std::to_string(SIGSEGV) + "\nFault 0x10\n")
           == "SIGSEGV");
    assert(isLikelyPointerAuthFailure(0x0021000102345678ull));
    assert(!isLikelyPointerAuthFailure(0x0000000102345678ull));
    assert(!isLikelyPointerAuthFailure(0xffffff8000001000ull));
    assert(nativeCrashHeadline("Signal " + std::to_string(SIGABRT)
                               + "\nException NSInvalidArgumentException: bad selector\n#0 0x1\n")
           == "SIGABRT (NSInvalidArgumentException)");
    assert(nativeCrashHeadline("Exception java.lang.IllegalStateException: no view\n"
                               "Addon {\"id\":\"x\",\"name\":\"Chat Bubbles\"}\n#0 at a.b(c)\n")
           == "java.lang.IllegalStateException in Chat Bubbles");
    assert(nativeCrashHeadline("Signal " + std::to_string(SIGTRAP)
                               + "\nException 6 code 1\n#0 0x1 Discord + 0x10\n")
           == kTrapHeadline);
    assert(nativeCrashHeadline("Signal " + std::to_string(SIGTRAP) + "\n#0 0x1\n")
           == kTrapHeadline);
    assert(
        nativeCrashHeadline("Signal " + std::to_string(SIGSEGV) + "\nException 1 code 2\n#0 0x1\n")
        == "SIGSEGV (EXC_BAD_ACCESS)");
    assert(nativeCrashHeadline("Signal " + std::to_string(SIGKILL) + "\nException 99 code 0\n")
               .find("(Mach exception 99)")
           != std::string::npos);
    assert(nativeCrashHeadline("").empty());
    assert(nativeCrashHeadline("garbage").empty());
    assert(describeNativeCrash(kStack).find("Addon Chat Bubbles\n") != std::string::npos);
    assert(describeNativeCrash(kStack).find("{\"id\"") == std::string::npos);
    assert(describeNativeCrash("Signal 5\nRegisters x0=0x1 esr=0xf2000001\n")
               .find("Syndrome BRK #0x1 (trap instruction, such as a failed Swift check)\n")
           != std::string::npos);
}

static void checkReport()
{
    LaunchReport quiet;
    assert(launchReportLine(quiet, "").empty());
    assert(launchReportJSON(quiet, "")["bundle"] == "active");
    assert(!launchReportJSON(quiet, "").contains("lastCrash"));
    assert(!launchReportJSON(quiet, "").contains("crashStack"));

    LaunchReport troubled{BundleState::RolledBack, 2, true, PreviousExit::Crashed};
    assert(
        launchReportLine(troubled, kStack)
        == "bundle rolled back · recovery mode · 2 early closes · previous launch crashed · last "
           "crash SIGSEGV in Chat Bubbles");
    nlohmann::json json = launchReportJSON(troubled, kStack);
    assert(json["previousExit"] == "crashed");
    assert(json["earlyCloses"] == 2);
    assert(json["lastCrash"] == "SIGSEGV in Chat Bubbles");
    assert(json["crashStack"].get<std::string>().starts_with("Signal"));
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
    assert(history.back().stack == kStack);
    assert(readCrashHistory(root.string()).back().stack == kStack);
    assert(std::filesystem::exists(root / kNativeCrashFile));

    LaunchReport report;
    report.revision     = "abc1234";
    report.channel      = "stable";
    nlohmann::json json = launchReportJSON(report, "", history);
    assert(json["revision"] == "abc1234");
    assert(json["crashes"].size() == kCrashHistoryLimit);
    assert(json["crashes"][0]["at"] == 3);
    assert(!json["crashes"][0].contains("stack"));

    std::filesystem::remove_all(root);
}

static void checkSourcesAndChecks()
{
    assert(bundleSourceOf("", false).empty());
    assert(bundleSourceOf("http://192.168.2.154:3000/", true) == "dev");
    assert(bundleSourceOf("https://cdn.example.com/unbound/pr/42/", false) == "pr");
    assert(pullRequestOf("https://cdn.example.com/unbound/pr/42/") == 42);
    assert(bundleSourceOf("https://example.com/bundle/", false) == "custom");

    setBundleSource("pr", 42);
    recordUpdateCheck(1000, "failed", "Bundle download returned HTTP 503");
    recordSettingsRecovery("restored");
    nlohmann::json json = launchReportJSON(launchReport(), "");
    assert(json["source"] == "pr" && json["pullRequest"] == 42);
    assert(json["lastCheck"]["outcome"] == "failed");
    assert(json["lastCheck"]["detail"] == "Bundle download returned HTTP 503");
    assert(json["settings"] == "restored");
}

int main()
{
    checkSourcesAndChecks();
    checkCrashHistory();
    checkNativeCrashes();
    checkReport();
    checkState();
    assert(loader::nativeCrashOutsideUnbound(
        "Signal 11\n#0 0x1 libsystem_platform.dylib + 0x18e4 _platform_strlen\n#1 0x2 "
        "DiscordMediaEngine + 0x57294\nThread 1\n#0 0x3 Unbound.dylib + 0x10"));
    assert(!loader::nativeCrashOutsideUnbound(
        "Signal 11\n#0 0x1 libobjc.A.dylib + 0x10 objc_release\n#1 0x2 Unbound.dylib + 0x20"));
    assert(!loader::nativeCrashOutsideUnbound("Signal 6\n#0 0x1 hermesvm + 0x10"));
    assert(!loader::nativeCrashOutsideUnbound(
        "Signal 11\nAddon {\"id\":\"unbound.example\"}\n#0 0x1 Discord + 0x10"));
    assert(!loader::nativeCrashOutsideUnbound(""));
    assert(!loader::nativeCrashOutsideUnbound("Signal 11"));
    return 0;
}
