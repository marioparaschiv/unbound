#include "LoaderSystemExits.h"

#include <algorithm>
#include <cctype>
#include <cstdio>
#include <ctime>
#include <utility>
#include <vector>

#include "LoaderCrashHandler.h"
#include "LoaderFiles.h"
#include "LoaderLaunchReport.h"
#include "LoaderLog.h"
#include "LoaderMetricKitCrash.h"

namespace loader::system_exits {
namespace {
    constexpr size_t kMaximumEvents       = 400;
    constexpr size_t kMaximumSeen         = 200;
    constexpr size_t kMaximumFrozenAddons = 5;
    constexpr size_t kMaximumHangStack    = 4000;
    constexpr size_t kMaximumHangStacks   = 3;

    std::mutex fileMutex;

    const std::pair<const char *, ExitKind> kExitCounters[] = {
        {"cumulativeMemoryResourceLimitExitCount", ExitKind::Memory},
        {"cumulativeAppWatchdogExitCount", ExitKind::Watchdog},
        {"cumulativeCPUResourceLimitExitCount", ExitKind::CPU},
        {"cumulativeSuspendedWithLockedFileExitCount", ExitKind::LockedFile},
    };

    nlohmann::json readStore(const std::string &documents)
    {
        nlohmann::json store = nlohmann::json::parse(
            readTextFile(joinPath(documents, kSystemExitsFile)).value_or("{}"), nullptr, false);
        if (!store.is_object())
        {
            store = nlohmann::json::object();
        }

        if (!store["events"].is_array())
        {
            store["events"] = nlohmann::json::array();
        }

        if (!store["seen"].is_array())
        {
            store["seen"] = nlohmann::json::array();
        }

        return store;
    }

    void trimFront(nlohmann::json &list, size_t limit)
    {
        if (list.size() > limit)
        {
            list.erase(list.begin(), list.begin() + static_cast<long>(list.size() - limit));
        }
    }

    void writeStore(const std::string &documents, nlohmann::json &store)
    {
        trimFront(store["events"], kMaximumEvents);
        trimFront(store["seen"], kMaximumSeen);
        if (!writeTextFileAtomically(joinPath(documents, kSystemExitsFile), store.dump()))
        {
            log(LogLevel::Error, LOG_CATEGORY_DEFAULT, "Failed to save the system exit record");
        }
    }

    bool markSeen(nlohmann::json &store, const std::string &key)
    {
        nlohmann::json &seen = store["seen"];
        if (std::find(seen.begin(), seen.end(), key) != seen.end())
        {
            return false;
        }

        seen.push_back(key);
        return true;
    }

    void addEvent(nlohmann::json &store, ExitKind kind, int64_t at, int64_t durationMs)
    {
        nlohmann::json event{{"at", at}, {"kind", exitKindName(kind)}};
        if (durationMs > 0)
        {
            event["ms"] = durationMs;
        }

        store["events"].push_back(std::move(event));
    }

    int64_t integerOf(const nlohmann::json &value)
    {
        if (value.is_number())
        {
            return value.get<int64_t>();
        }

        return value.is_string() ? std::atoll(value.get<std::string>().c_str()) : 0;
    }

    nlohmann::json parsePayload(const std::string &payloadJSON)
    {
        nlohmann::json payload = nlohmann::json::parse(payloadJSON, nullptr, false);
        return payload.is_object() ? payload : nlohmann::json::object();
    }

    std::string stringMember(const nlohmann::json &object, const char *name)
    {
        auto found = object.find(name);
        return found != object.end() && found->is_string() ? found->get<std::string>()
                                                           : std::string();
    }

    void addExitCounts(nlohmann::json &store, const nlohmann::json &exits, int64_t at)
    {
        if (!exits.is_object())
        {
            return;
        }

        for (const auto &[counter, kind] : kExitCounters)
        {
            auto found    = exits.find(counter);
            int64_t count = found == exits.end() ? 0 : std::min<int64_t>(integerOf(*found), 50);
            for (int64_t index = 0; index < count; index++)
            {
                addEvent(store, kind, at, 0);
            }
        }
    }
}

std::string exitKindName(ExitKind kind)
{
    switch (kind)
    {
        case ExitKind::Memory:
            return "memory";
        case ExitKind::Watchdog:
            return "watchdog";
        case ExitKind::CPU:
            return "cpu";
        case ExitKind::LockedFile:
            return "lockedFile";
        case ExitKind::Hang:
            return "hang";
        case ExitKind::Freeze:
            return "freeze";
    }

    return "unknown";
}

int64_t parseMetricKitTimestamp(const std::string &timestamp)
{
    std::tm parsed{};
    if (std::sscanf(timestamp.c_str(), "%d-%d-%d %d:%d:%d", &parsed.tm_year, &parsed.tm_mon,
                    &parsed.tm_mday, &parsed.tm_hour, &parsed.tm_min, &parsed.tm_sec)
        != 6)
    {
        return 0;
    }

    parsed.tm_year -= 1900;
    parsed.tm_mon -= 1;
    parsed.tm_isdst = -1;
    return static_cast<int64_t>(mktime(&parsed)) * 1000;
}

int64_t parseMetricKitDuration(const std::string &duration)
{
    std::string number;
    std::string unit;
    for (char character : duration)
    {
        if (std::isdigit(static_cast<unsigned char>(character)) || character == '.')
        {
            if (unit.empty())
            {
                number += character;
            }
        }
        else if (std::isalpha(static_cast<unsigned char>(character)))
        {
            unit += static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
        }
    }

    if (number.empty())
    {
        return 0;
    }

    double value = std::atof(number.c_str());
    if (unit.starts_with("ms"))
    {
        return static_cast<int64_t>(value);
    }

    if (unit.starts_with("min"))
    {
        return static_cast<int64_t>(value * 60000);
    }

    return static_cast<int64_t>(value * 1000);
}

void recordMetricKitMetrics(const std::string &documents, const std::string &payloadJSON)
{
    nlohmann::json payload = parsePayload(payloadJSON);
    std::string end        = stringMember(payload, "timeStampEnd");
    auto exits             = payload.find("applicationExitMetrics");
    if (end.empty() || exits == payload.end() || !exits->is_object())
    {
        return;
    }

    std::lock_guard<std::mutex> lock(fileMutex);
    nlohmann::json store = readStore(documents);
    if (!markSeen(store, "metrics:" + end))
    {
        return;
    }

    int64_t at = parseMetricKitTimestamp(end);
    addExitCounts(store, exits->value("foregroundExitData", nlohmann::json()), at);
    addExitCounts(store, exits->value("backgroundExitData", nlohmann::json()), at);
    writeStore(documents, store);
}

static void keepNewestHangStacks(nlohmann::json &events)
{
    size_t kept = 0;
    for (auto event = events.rbegin(); event != events.rend(); ++event)
    {
        if (!event->is_object() || !event->contains("stack"))
        {
            continue;
        }

        if (++kept > kMaximumHangStacks)
        {
            event->erase("stack");
        }
    }
}

HangSuspect hangSuspect(const nlohmann::json &events, int64_t windowStart, int64_t windowEnd)
{
    HangSuspect suspect;
    int64_t longest = 0;
    for (const nlohmann::json &event : events)
    {
        if (!event.is_object() || event.value("kind", std::string()) != "freeze")
        {
            continue;
        }

        int64_t at = event.value("at", int64_t{0});
        int64_t ms = event.value("ms", int64_t{0});
        if (at < windowStart || at > windowEnd || ms <= longest)
        {
            continue;
        }

        suspect = {event.value("addon", std::string()), event.value("addonId", std::string())};
        longest = ms;
    }

    return suspect;
}

bool stackRunsUnbound(const std::string &stack)
{
    return stack.find(" Unbound.dylib + ") != std::string::npos
           || stack.find(" Unbound + ") != std::string::npos;
}

static void recordHangs(nlohmann::json &store, const nlohmann::json &payload, int64_t at,
                        int64_t windowStart)
{
    auto hangs = payload.find("hangDiagnostics");
    if (hangs == payload.end() || !hangs->is_array())
    {
        return;
    }

    HangSuspect suspect = hangSuspect(store["events"], windowStart, at);
    for (const nlohmann::json &hang : *hangs)
    {
        nlohmann::json metadata = hang.value("diagnosticMetaData", nlohmann::json::object());
        addEvent(store, ExitKind::Hang, at,
                 parseMetricKitDuration(stringMember(metadata, "hangDuration")));
        nlohmann::json &event = store["events"].back();
        if (std::optional<std::string> stack = metricKitHangStack(hang))
        {
            event["stack"] = stack->substr(0, kMaximumHangStack);
            if (stackRunsUnbound(*stack))
            {
                event["inUnbound"] = true;
            }
        }

        if (!suspect.name.empty())
        {
            event["addon"] = suspect.name;
        }

        if (!suspect.id.empty())
        {
            event["addonId"] = suspect.id;
        }
    }

    keepNewestHangStacks(store["events"]);
}

static std::optional<std::string> latestCrashStack(const nlohmann::json &payload)
{
    auto crashes = payload.find("crashDiagnostics");
    if (crashes == payload.end() || !crashes->is_array() || crashes->empty())
    {
        return std::nullopt;
    }

    return metricKitCrashStack(crashes->back());
}

void recordMetricKitDiagnostics(const std::string &documents, const std::string &payloadJSON)
{
    nlohmann::json payload = parsePayload(payloadJSON);
    std::string end        = stringMember(payload, "timeStampEnd");
    if (end.empty())
    {
        return;
    }

    int64_t at = parseMetricKitTimestamp(end);
    std::optional<std::string> crash;
    {
        std::lock_guard<std::mutex> lock(fileMutex);
        nlohmann::json store = readStore(documents);
        if (!markSeen(store, "diagnostics:" + end))
        {
            return;
        }

        crash             = latestCrashStack(payload);
        std::string begin = stringMember(payload, "timeStampBegin");
        int64_t windowStart =
            begin.empty() ? at - kSummaryWindowMs : parseMetricKitTimestamp(begin);
        recordHangs(store, payload, at, windowStart);
        writeStore(documents, store);
    }

    if (crash && adoptPreviousNativeCrash(*crash))
    {
        recordCrash(documents, *crash, at);
    }
}

void recordExit(const std::string &documents, const std::string &key, ExitKind kind, int64_t at,
                int64_t durationMs)
{
    std::lock_guard<std::mutex> lock(fileMutex);
    nlohmann::json store = readStore(documents);
    if (!markSeen(store, key))
    {
        return;
    }

    addEvent(store, kind, at, durationMs);
    writeStore(documents, store);
}

void recordFreeze(const std::string &documents, const std::string &addon, int64_t at,
                  int64_t durationMs, const std::string &addonId)
{
    if (addon.empty())
    {
        return;
    }

    std::lock_guard<std::mutex> lock(fileMutex);
    nlohmann::json store = readStore(documents);
    addEvent(store, ExitKind::Freeze, at, durationMs);
    store["events"].back()["addon"] = addon;
    if (!addonId.empty())
    {
        store["events"].back()["addonId"] = addonId;
    }

    writeStore(documents, store);
}

namespace {
    struct FrozenAddon {
        std::string name;
        int64_t count     = 0;
        int64_t longestMs = 0;
    };

    nlohmann::json frozenAddonsJSON(std::vector<FrozenAddon> addons)
    {
        std::stable_sort(addons.begin(), addons.end(),
                         [](const FrozenAddon &left, const FrozenAddon &right) {
                             return left.count > right.count;
                         });
        if (addons.size() > kMaximumFrozenAddons)
        {
            addons.resize(kMaximumFrozenAddons);
        }

        nlohmann::json list = nlohmann::json::array();
        for (const FrozenAddon &addon : addons)
        {
            list.push_back(
                {{"name", addon.name}, {"count", addon.count}, {"longestMs", addon.longestMs}});
        }

        return list;
    }

    void countFreeze(std::vector<FrozenAddon> &addons, const nlohmann::json &event)
    {
        std::string name = event.value("addon", std::string());
        if (name.empty())
        {
            return;
        }

        auto found = std::find_if(addons.begin(), addons.end(), [&name](const FrozenAddon &addon) {
            return addon.name == name;
        });
        if (found == addons.end())
        {
            addons.push_back({name});
            found = addons.end() - 1;
        }

        found->count++;
        found->longestMs = std::max(found->longestMs, event.value("ms", int64_t{0}));
    }
}

nlohmann::json summary(const std::string &documents, int64_t now)
{
    nlohmann::json store;
    {
        std::lock_guard<std::mutex> lock(fileMutex);
        store = readStore(documents);
    }

    nlohmann::json counts = nlohmann::json::object();
    int64_t longestHangMs = 0;
    nlohmann::json lastHang;
    std::vector<FrozenAddon> frozen;
    for (const nlohmann::json &event : store["events"])
    {
        if (!event.is_object() || now - event.value("at", int64_t{0}) > kSummaryWindowMs)
        {
            continue;
        }

        std::string kind = event.value("kind", std::string());
        if (kind == "freeze")
        {
            countFreeze(frozen, event);
            continue;
        }

        if (kind == "hang" && event.contains("stack")
            && (lastHang.is_null()
                || event.value("at", int64_t{0}) >= lastHang.value("at", int64_t{0})))
        {
            lastHang = {{"at", event.value("at", int64_t{0})},
                        {"ms", event.value("ms", int64_t{0})},
                        {"stack", event.value("stack", std::string())}};
            for (const char *key : {"addon", "addonId"})
            {
                if (event.contains(key))
                {
                    lastHang[key] = event[key];
                }
            }

            if (event.value("inUnbound", false))
            {
                lastHang["inUnbound"] = true;
            }
        }

        std::string name = kind == "hang" ? "hangs" : kind;
        counts[name]     = counts.value(name, 0) + 1;
        longestHangMs    = std::max(longestHangMs, event.value("ms", int64_t{0}));
    }

    if (longestHangMs > 0)
    {
        counts["longestHangMs"] = longestHangMs;
    }

    if (!frozen.empty())
    {
        counts["freezes"] = frozenAddonsJSON(std::move(frozen));
    }

    if (!lastHang.is_null())
    {
        counts["lastHang"] = std::move(lastHang);
    }

    return counts;
}
}
