#include <cassert>
#include <string>
#include <utility>
#include <vector>

#include "LoaderLog.h"

struct Entry {
    loader::LogLevel level;
    std::string category;
    std::string message;
};

int main()
{
    std::vector<Entry> entries;
    loader::setLogSink(
        [&](loader::LogLevel level, const std::string &category, const std::string &message) {
            entries.push_back({level, category, message});
        });

    for (const char *category : loader::kLogCategories)
    {
        assert(loader::isLogCategory(category));
    }

    assert(loader::isLogCategory(LOG_CATEGORY_HOOKS));
    assert(!loader::isLogCategory("Default"));
    assert(!loader::isLogCategory(""));

    assert(loader::logLevelFromIndex(0) == loader::LogLevel::Debug);
    assert(loader::logLevelFromIndex(1) == loader::LogLevel::Info);
    assert(loader::logLevelFromIndex(2) == loader::LogLevel::Warning);
    assert(loader::logLevelFromIndex(3) == loader::LogLevel::Error);
    assert(loader::logLevelFromIndex(-1) == loader::LogLevel::Info);
    assert(loader::logLevelFromIndex(9) == loader::LogLevel::Info);

    assert(loader::formatLogLine("themes", "Theme updated.") == "[themes] Theme updated.");

    loader::logFromPlatform(2, LOG_CATEGORY_RUNTIME, "Slow bundle.");
    assert(entries.size() == 1);
    assert(entries[0].level == loader::LogLevel::Warning);
    assert(entries[0].category == "runtime" && entries[0].message == "Slow bundle.");

    loader::logFromPlatform(3, "unknown", "Broken.");
    assert(entries.size() == 2);
    assert(entries[1].level == loader::LogLevel::Error);
    assert(entries[1].category == LOG_CATEGORY_DEFAULT);
    assert(entries[1].message == "[unknown] Broken.");

    loader::setLogSink(nullptr);
    loader::log(loader::LogLevel::Info, LOG_CATEGORY_DEFAULT, "dropped");
    assert(entries.size() == 2);

    assert(loader::scopedLogLine({"Plugins", "Petpet"}, "Ready.") == "[Plugins/Petpet] Ready.");
    assert(loader::scopedLogLine({}, "Bare.") == "Bare.");

    std::vector<std::pair<loader::LogLevel, std::string>> systemLines;
    loader::setSystemLogSink([&](loader::LogLevel level, const std::string &line) {
        systemLines.emplace_back(level, line);
    });
    loader::writeSystemLog(loader::LogLevel::Error, "[Plugins/Petpet] Failed.");
    assert(systemLines.size() == 1);
    assert(systemLines[0].first == loader::LogLevel::Error);
    assert(systemLines[0].second == "[Plugins/Petpet] Failed.");
    assert(entries.size() == 2);

    loader::setSystemLogSink(nullptr);
    loader::writeSystemLog(loader::LogLevel::Info, "dropped");
    assert(systemLines.size() == 1);
    return 0;
}
