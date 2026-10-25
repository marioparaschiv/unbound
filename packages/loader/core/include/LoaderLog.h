#pragma once

#include <array>
#include <functional>
#include <string>

#include "LoaderLogCategories.h"

namespace loader {
enum class LogLevel
{
    Debug,
    Info,
    Warning,
    Error,
};

inline constexpr std::array<const char *, 13> kLogCategories = {
    LOG_CATEGORY_DEFAULT,  LOG_CATEGORY_RUNTIME, LOG_CATEGORY_UPDATER,    LOG_CATEGORY_THEMES,
    LOG_CATEGORY_FONTS,    LOG_CATEGORY_CHATUI,  LOG_CATEGORY_PLUGINS,    LOG_CATEGORY_SETTINGS,
    LOG_CATEGORY_TOOLBOX,  LOG_CATEGORY_HOOKS,   LOG_CATEGORY_FILESYSTEM, LOG_CATEGORY_UTILITIES,
    LOG_CATEGORY_DEBUGGER,
};

using LogSink = std::function<void(LogLevel, const std::string &, const std::string &)>;

void        setLogSink(LogSink sink);
void        log(LogLevel level, const std::string &category, const std::string &message);
bool        isLogCategory(const std::string &category);
LogLevel    logLevelFromIndex(int index);
std::string formatLogLine(const std::string &category, const std::string &message);
void        logFromPlatform(int level, const std::string &category, const std::string &message);
}
