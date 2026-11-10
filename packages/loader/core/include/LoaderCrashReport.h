#pragma once

#include <optional>
#include <string>

#include "LoaderToolbox.h"

namespace loader {
// Lines of the previous launch's log a crash report carries; GitHub caps a new-issue URL's length.
constexpr std::size_t kCrashReportLogLines  = 40;
constexpr std::size_t kCrashReportLogBytes  = 4000;
constexpr std::size_t kCrashReportURLLength = 8000;

// Notes what the loader just recovered from, for a report the person chooses to open.
void                       recordCrashSummary(const std::string &summary);
std::optional<std::string> crashSummary();

// A prefilled GitHub crash report: the toolbox's environment, what happened, and the end of the
// previous launch's log. Nothing is sent until the person submits the issue.
toolbox::IssueReport crashReport(const toolbox::IssueReport &environment,
                                 const std::string &summary, const std::string &logTail);
std::string crashReportURL(const toolbox::IssueReport &environment, const std::string &summary,
                           const std::string &logTail);
}
