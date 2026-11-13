#include "LoaderLaunchGuard.h"

#include <nlohmann/json.hpp>

#include "LoaderFiles.h"
#include "LoaderLog.h"

namespace loader {
LaunchGuard::LaunchGuard(std::string directory) : directory_(std::move(directory)) {}

std::string LaunchGuard::path() const
{
    return joinPath(directory_, kFile);
}

struct Marker {
    int  failures = -1;
    bool frozen   = false;
    bool shown    = true;
};

static Marker readMarker(const std::optional<std::string> &contents)
{
    if (!contents)
    {
        return {};
    }
    nlohmann::json parsed   = nlohmann::json::parse(*contents, nullptr, false);
    auto           failures = parsed.is_object() ? parsed.find("failures") : parsed.end();
    auto           frozen   = parsed.is_object() ? parsed.find("frozen") : parsed.end();
    auto           shown    = parsed.is_object() ? parsed.find("shown") : parsed.end();
    return {failures != parsed.end() && failures->is_number_integer() && *failures >= 0
                ? failures->get<int>()
                : 0,
            frozen != parsed.end() && frozen->is_boolean() && frozen->get<bool>(),
            shown == parsed.end() || !shown->is_boolean() || shown->get<bool>()};
}

static nlohmann::json markerJSON(const Marker &marker)
{
    nlohmann::json json = {{"failures", marker.failures}};
    if (marker.frozen)
    {
        json["frozen"] = true;
    }
    if (!marker.shown)
    {
        json["shown"] = false;
    }
    return json;
}

LaunchVerdict LaunchGuard::begin(PreviousExit previous) const
{
    // A marker left behind means the previous launch never reached succeed().
    LaunchVerdict verdict;
    Marker        marker   = readMarker(readTextFile(path()));
    int           recorded = marker.failures;
    if (recorded >= 0 && !marker.shown && !marker.frozen)
    {
        log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
            "Discord's previous launch ran only in the background and never showed; it does not "
            "count.");
        verdict.failures = recorded;
        createDirectories(directory_);
        if (!writeTextFileAtomically(path(), markerJSON({recorded}).dump()))
        {
            log(LogLevel::Error, LOG_CATEGORY_DEFAULT, "Failed to arm the launch guard.");
        }
        return verdict;
    }
    if (recorded >= 0 && marker.frozen)
    {
        log(LogLevel::Warning, LOG_CATEGORY_DEFAULT,
            "Discord's previous launch never rendered its first screen.");
    }
    else if (recorded >= 0 && previous == PreviousExit::Ended)
    {
        // Swiping Discord away during startup is not a crash, and it ends the streak.
        log(LogLevel::Info, LOG_CATEGORY_DEFAULT,
            "Discord's previous launch was closed before it was healthy, without crashing.");
        recorded = -1;
    }
    verdict.failures      = recorded + 1;
    verdict.rollBack      = verdict.failures == kRollBackAfter;
    verdict.enterRecovery = verdict.failures == kRecoveryAfter;

    if (verdict.failures > 0)
    {
        log(LogLevel::Warning, LOG_CATEGORY_DEFAULT,
            "Discord's previous launch ended before it was healthy; " +
                std::to_string(verdict.failures) + " in a row.");
    }

    createDirectories(directory_);
    if (!writeTextFileAtomically(path(), nlohmann::json{{"failures", verdict.failures}}.dump()))
    {
        log(LogLevel::Error, LOG_CATEGORY_DEFAULT, "Failed to arm the launch guard.");
    }
    return verdict;
}

bool LaunchGuard::succeed() const
{
    return removeFile(path());
}

bool LaunchGuard::markFrozen() const
{
    Marker marker = readMarker(readTextFile(path()));
    if (marker.failures < 0)
    {
        return false;
    }
    marker.frozen = true;
    return writeTextFileAtomically(path(), markerJSON(marker).dump());
}

bool LaunchGuard::markHidden() const
{
    Marker marker = readMarker(readTextFile(path()));
    if (marker.failures < 0)
    {
        return false;
    }
    marker.shown = false;
    return writeTextFileAtomically(path(), markerJSON(marker).dump());
}

bool LaunchGuard::markShown() const
{
    Marker marker = readMarker(readTextFile(path()));
    if (marker.failures < 0 || marker.shown)
    {
        return marker.failures >= 0;
    }
    marker.shown = true;
    return writeTextFileAtomically(path(), markerJSON(marker).dump());
}

std::string launchRollBackNotice(int failures)
{
    return "Discord closed during startup " + std::to_string(failures) +
           " times in a row, so Unbound went back to the bundle it ran before its last update.";
}

std::string launchRecoveryNotice(int failures)
{
    return "Discord closed during startup " + std::to_string(failures) +
           " times in a row, so Unbound turned on Recovery Mode. Turn it off from the toolbox "
           "once you have removed what caused it.";
}
}
