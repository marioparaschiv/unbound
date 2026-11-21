#include "LoaderLaunchReport.h"

#include <cctype>
#include <csignal>
#include <cstdlib>
#include <mutex>
#include <optional>
#include <regex>
#include <utility>
#include <vector>

#include "LoaderCrashHandler.h"
#include "LoaderDiskFull.h"
#include "LoaderExceptionSyndrome.h"
#include "LoaderFiles.h"

namespace loader {
static std::mutex reportMutex;
static LaunchReport currentReport;

LaunchReport launchReport()
{
    std::lock_guard<std::mutex> lock(reportMutex);
    return currentReport;
}

void setBundleState(BundleState state)
{
    std::lock_guard<std::mutex> lock(reportMutex);
    currentReport.bundle = state;
}

void recordLaunchVerdict(int earlyCloses, bool recovery, PreviousExit previousExit)
{
    std::lock_guard<std::mutex> lock(reportMutex);
    currentReport.earlyCloses  = earlyCloses;
    currentReport.recovery     = recovery;
    currentReport.previousExit = previousExit;
}

void setRunningBundle(const std::string &revision, const std::string &channel)
{
    std::lock_guard<std::mutex> lock(reportMutex);
    currentReport.revision = revision;
    currentReport.channel  = channel;
}

void recordLaunchTiming(int64_t bundleMs, int64_t firstRenderMs)
{
    std::lock_guard<std::mutex> lock(reportMutex);
    currentReport.bundleMs      = bundleMs;
    currentReport.firstRenderMs = firstRenderMs;
}

void setBundleSource(const std::string &source, int pullRequest)
{
    std::lock_guard<std::mutex> lock(reportMutex);
    currentReport.source      = source;
    currentReport.pullRequest = pullRequest;
}

void recordUpdateCheck(int64_t at, const std::string &outcome, const std::string &detail)
{
    std::lock_guard<std::mutex> lock(reportMutex);
    currentReport.checkedAt    = at;
    currentReport.checkOutcome = outcome;
    currentReport.checkDetail  = detail.substr(0, 160);
}

void recordSettingsRecovery(const std::string &recovery)
{
    std::lock_guard<std::mutex> lock(reportMutex);
    currentReport.settingsRecovery = recovery;
}

int pullRequestOf(const std::string &updateURL)
{
    static const std::regex pullRequestPath(R"(/pr/(\d+)(/|$))");
    std::smatch match;
    return std::regex_search(updateURL, match, pullRequestPath) ? std::stoi(match[1].str()) : 0;
}

std::string bundleSourceOf(const std::string &updateURL, bool development)
{
    if (updateURL.empty())
    {
        return "";
    }

    if (development)
    {
        return "dev";
    }

    return pullRequestOf(updateURL) ? "pr" : "custom";
}

constexpr size_t kCrashStackLimit = 16000;

std::vector<NativeCrashRecord> readCrashHistory(const std::string &directory)
{
    nlohmann::json parsed = nlohmann::json::parse(
        readTextFile(joinPath(directory, kCrashHistoryFile)).value_or("[]"), nullptr, false);
    std::vector<NativeCrashRecord> history;
    if (!parsed.is_array())
    {
        return history;
    }

    for (const nlohmann::json &entry : parsed)
    {
        if (entry.is_object() && entry.contains("at") && entry["at"].is_number_integer()
            && entry.contains("crash") && entry["crash"].is_string())
        {
            std::string stack = entry.contains("stack") && entry["stack"].is_string()
                                    ? entry["stack"].get<std::string>()
                                    : "";
            history.push_back(
                {entry["at"].get<int64_t>(), entry["crash"].get<std::string>(), std::move(stack)});
        }
    }

    return history;
}

bool recordCrash(const std::string &directory, const std::string &stack, int64_t at)
{
    std::string crash = nativeCrashHeadline(stack);
    if (crash.empty())
    {
        return false;
    }

    std::vector<NativeCrashRecord> history = readCrashHistory(directory);
    history.push_back({at, crash, stack.substr(0, kCrashStackLimit)});
    if (history.size() > kCrashHistoryLimit)
    {
        history.erase(history.begin(),
                      history.begin() + static_cast<long>(history.size() - kCrashHistoryLimit));
    }

    nlohmann::json json = nlohmann::json::array();
    for (const NativeCrashRecord &record : history)
    {
        nlohmann::json entry{{"at", record.at}, {"crash", record.crash}};
        if (!record.stack.empty())
        {
            entry["stack"] = record.stack;
        }

        json.push_back(std::move(entry));
    }

    bool kept =
        writeTextFileAtomically(joinPath(directory, kNativeCrashFile), history.back().stack);
    return writeTextFileAtomically(joinPath(directory, kCrashHistoryFile), json.dump()) && kept;
}

std::string bundleStateName(BundleState state)
{
    switch (state)
    {
        case BundleState::Active:
            return "active";
        case BundleState::Trial:
            return "trial";
        case BundleState::Discarded:
            return "discarded";
        case BundleState::RolledBack:
            return "rolled back";
    }

    return "active";
}

static std::string previousExitName(PreviousExit exit)
{
    switch (exit)
    {
        case PreviousExit::Crashed:
            return "crashed";
        case PreviousExit::Ended:
            return "ended";
        case PreviousExit::Unknown:
            break;
    }

    return "unknown";
}

static std::string signalName(int signal)
{
    switch (signal)
    {
        case SIGSEGV:
            return "SIGSEGV";
        case SIGABRT:
            return "SIGABRT";
        case SIGBUS:
            return "SIGBUS";
        case SIGILL:
            return "SIGILL";
        case SIGFPE:
            return "SIGFPE";
        case SIGTRAP:
            return "SIGTRAP";
        default:
            return "signal " + std::to_string(signal);
    }
}

static std::vector<std::string> linesOf(const std::string &text)
{
    std::vector<std::string> lines;
    size_t start = 0;
    while (start < text.size())
    {
        size_t end = text.find('\n', start);
        if (end == std::string::npos)
        {
            end = text.size();
        }

        lines.push_back(text.substr(start, end - start));
        start = end + 1;
    }

    return lines;
}

static std::optional<std::string> addonName(const std::string &line)
{
    constexpr std::string_view kPrefix = "Addon ";
    if (!line.starts_with(kPrefix))
    {
        return std::nullopt;
    }

    nlohmann::json record = nlohmann::json::parse(line.substr(kPrefix.size()), nullptr, false);
    if (!record.is_object())
    {
        return std::nullopt;
    }

    for (const char *key : {"name", "id"})
    {
        if (record.contains(key) && record[key].is_string()
            && !record[key].get<std::string>().empty())
        {
            return record[key].get<std::string>();
        }
    }

    return std::nullopt;
}

static std::string machExceptionName(int type)
{
    switch (type)
    {
        case 1:
            return "EXC_BAD_ACCESS";
        case 2:
            return "EXC_BAD_INSTRUCTION";
        case 3:
            return "EXC_ARITHMETIC";
        case 5:
            return "EXC_SOFTWARE";
        case 6:
            return "EXC_BREAKPOINT";
        case 10:
            return "EXC_CRASH";
        case 11:
            return "EXC_RESOURCE";
        case 12:
            return "EXC_GUARD";
        default:
            return "Mach exception " + std::to_string(type);
    }
}

static std::string exceptionName(const std::string &line)
{
    std::string text = line.substr(std::string("Exception ").size());
    if (!text.empty() && std::isdigit(static_cast<unsigned char>(text.front())))
    {
        return machExceptionName(std::atoi(text.c_str()));
    }

    size_t colon = text.find(':');
    return colon == std::string::npos ? text : text.substr(0, colon);
}

static constexpr const char *kTrapReason =
#if defined(__APPLE__)
    "Swift runtime check failed";
#else
    "trap instruction";
#endif

bool isLikelyPointerAuthFailure(uint64_t address)
{
    uint64_t high = address >> 47;
    return high != 0 && high != 0x1ffff;
}

static bool faultsOnSignedPointer(const std::vector<std::string> &lines)
{
    for (const std::string &line : lines)
    {
        if (line.starts_with("Fault 0x"))
        {
            return isLikelyPointerAuthFailure(std::strtoull(line.c_str() + 6, nullptr, 16));
        }
    }

    return false;
}

std::string nativeCrashHeadline(const std::string &stack)
{
    std::vector<std::string> lines = linesOf(stack);
    bool anr                       = !lines.empty() && lines.front().starts_with("ANR ");
    bool exception                 = !lines.empty() && lines.front().starts_with("Exception ");
    if (!anr && !exception && (lines.empty() || !lines.front().starts_with("Signal ")))
    {
        return "";
    }

    std::string headline = anr         ? "ANR (not responding)"
                           : exception ? exceptionName(lines.front())
                                       : signalName(std::atoi(lines.front().c_str() + 7));
    bool trap            = !anr && !exception && std::atoi(lines.front().c_str() + 7) == SIGTRAP;
    if (trap)
    {
        headline += std::string(" (") + kTrapReason + ")";
    }
    else if (!anr && !exception && lines.size() > 1 && lines[1].starts_with("Exception "))
    {
        headline += " (" + exceptionName(lines[1]) + ")";
    }
    else if (!anr && !exception && faultsOnSignedPointer(lines))
    {
        headline += " (likely pointer authentication failure)";
    }

    for (size_t index = 1; index < lines.size(); index++)
    {
        if (std::optional<std::string> name = addonName(lines[index]))
        {
            headline += " in " + *name;
            break;
        }
    }

    return headline;
}

static std::string lowered(std::string value)
{
    for (char &character : value)
    {
        character = static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
    }

    return value;
}

static bool isUnboundImage(const std::string &image)
{
    const std::string name = lowered(image);
    for (const char *prefix : {"unbound", "libunbound", "hermes", "libhermes"})
    {
        if (name.rfind(prefix, 0) == 0)
        {
            return true;
        }
    }

    return false;
}

bool nativeCrashOutsideUnbound(const std::string &stack)
{
    static const std::regex frame(R"(^#\d+\s+(?:0x[0-9a-fA-F]+\s+)?(\S+)\s+\+\s+0x)");
    size_t frames = 0;
    size_t start  = 0;
    while (start <= stack.size())
    {
        size_t end = stack.find('\n', start);
        std::string line =
            stack.substr(start, end == std::string::npos ? std::string::npos : end - start);
        if (line.rfind("Registers ", 0) == 0 || line.rfind("Thread ", 0) == 0)
        {
            break;
        }

        if (line.rfind("Addon {", 0) == 0)
        {
            return false;
        }

        std::smatch match;
        if (std::regex_search(line, match, frame))
        {
            if (isUnboundImage(match[1].str()))
            {
                return false;
            }

            ++frames;
        }

        if (end == std::string::npos)
        {
            break;
        }

        start = end + 1;
    }

    return frames > 0;
}

std::string describeNativeCrash(const std::string &stack)
{
    std::string described;
    for (const std::string &line : linesOf(stack))
    {
        std::optional<std::string> name = addonName(line);
        described += (name ? "Addon " + *name : line) + "\n";
        if (std::optional<uint64_t> esr = syndromeOfRegisters(line))
        {
            described += "Syndrome " + describeExceptionSyndrome(*esr) + "\n";
        }
    }

    return described;
}

nlohmann::json launchReportJSON(const LaunchReport &report, const std::string &nativeCrash,
                                const std::vector<NativeCrashRecord> &history)
{
    nlohmann::json json{{"bundle", bundleStateName(report.bundle)},
                        {"earlyCloses", report.earlyCloses},
                        {"recovery", report.recovery},
                        {"previousExit", previousExitName(report.previousExit)}};
    if (std::string headline = nativeCrashHeadline(nativeCrash); !headline.empty())
    {
        json["lastCrash"]  = headline;
        json["crashStack"] = nativeCrash.substr(0, kCrashStackLimit);
    }

    if (report.firstRenderMs > 0)
    {
        json["bundleMs"]      = report.bundleMs;
        json["firstRenderMs"] = report.firstRenderMs;
    }

    if (!report.source.empty())
    {
        json["source"] = report.source;
    }

    if (report.pullRequest > 0)
    {
        json["pullRequest"] = report.pullRequest;
    }

    if (report.checkedAt > 0)
    {
        json["lastCheck"] = {{"at", report.checkedAt}, {"outcome", report.checkOutcome}};
        if (!report.checkDetail.empty())
        {
            json["lastCheck"]["detail"] = report.checkDetail;
        }
    }

    if (!report.settingsRecovery.empty())
    {
        json["settings"] = report.settingsRecovery;
    }

    if (!report.revision.empty())
    {
        json["revision"] = report.revision;
        json["channel"]  = report.channel;
    }

    if (std::optional<DiskFullNote> full = diskFullNote())
    {
        json["diskFull"] = {{"at", full->at}, {"file", full->file}};
    }

    if (!history.empty())
    {
        nlohmann::json crashes = nlohmann::json::array();
        for (const NativeCrashRecord &record : history)
        {
            crashes.push_back({{"at", record.at}, {"crash", record.crash}});
        }

        json["crashes"] = crashes;
    }

    return json;
}

std::string launchReportLine(const LaunchReport &report, const std::string &nativeCrash)
{
    std::vector<std::string> parts;
    if (report.bundle != BundleState::Active)
    {
        parts.push_back("bundle " + bundleStateName(report.bundle));
    }

    if (report.recovery)
    {
        parts.emplace_back("recovery mode");
    }

    if (report.earlyCloses > 0)
    {
        parts.push_back(std::to_string(report.earlyCloses)
                        + (report.earlyCloses == 1 ? " early close" : " early closes"));
    }

    if (report.previousExit == PreviousExit::Crashed)
    {
        parts.emplace_back("previous launch crashed");
    }

    if (std::string headline = nativeCrashHeadline(nativeCrash); !headline.empty())
    {
        parts.push_back("last crash " + headline);
    }

    std::string line;
    for (const std::string &part : parts)
    {
        line += (line.empty() ? "" : " · ") + part;
    }

    return line;
}
}
