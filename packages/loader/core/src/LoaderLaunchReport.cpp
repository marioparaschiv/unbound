#include "LoaderLaunchReport.h"

#include <csignal>
#include <cstdlib>
#include <mutex>
#include <optional>
#include <vector>

#include "LoaderFiles.h"

namespace loader {
static std::mutex   reportMutex;
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
        if (entry.is_object() && entry.contains("at") && entry["at"].is_number_integer() &&
            entry.contains("crash") && entry["crash"].is_string())
        {
            history.push_back({entry["at"].get<int64_t>(), entry["crash"].get<std::string>()});
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
    history.push_back({at, crash});
    if (history.size() > kCrashHistoryLimit)
    {
        history.erase(history.begin(),
                      history.begin() + static_cast<long>(history.size() - kCrashHistoryLimit));
    }
    nlohmann::json json = nlohmann::json::array();
    for (const NativeCrashRecord &record : history)
    {
        json.push_back({{"at", record.at}, {"crash", record.crash}});
    }
    return writeTextFileAtomically(joinPath(directory, kCrashHistoryFile), json.dump());
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
    size_t                   start = 0;
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
        if (record.contains(key) && record[key].is_string() &&
            !record[key].get<std::string>().empty())
        {
            return record[key].get<std::string>();
        }
    }
    return std::nullopt;
}

std::string nativeCrashHeadline(const std::string &stack)
{
    std::vector<std::string> lines = linesOf(stack);
    if (lines.empty() || !lines.front().starts_with("Signal "))
    {
        return "";
    }
    std::string headline = signalName(std::atoi(lines.front().c_str() + 7));
    if (lines.size() > 1)
    {
        if (std::optional<std::string> name = addonName(lines[1]))
        {
            headline += " in " + *name;
        }
    }
    return headline;
}

std::string describeNativeCrash(const std::string &stack)
{
    std::string described;
    for (const std::string &line : linesOf(stack))
    {
        std::optional<std::string> name = addonName(line);
        described += (name ? "Addon " + *name : line) + "\n";
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
        json["lastCrash"] = headline;
    }
    if (report.firstRenderMs > 0)
    {
        json["bundleMs"]      = report.bundleMs;
        json["firstRenderMs"] = report.firstRenderMs;
    }
    if (!report.revision.empty())
    {
        json["revision"] = report.revision;
        json["channel"]  = report.channel;
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
        parts.push_back(std::to_string(report.earlyCloses) +
                        (report.earlyCloses == 1 ? " early close" : " early closes"));
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
