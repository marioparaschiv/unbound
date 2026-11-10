#include "LoaderCrashReport.h"

#include <mutex>

namespace loader {
static std::mutex                 summaryMutex;
static std::optional<std::string> lastSummary;

void recordCrashSummary(const std::string &summary)
{
    std::lock_guard<std::mutex> lock(summaryMutex);
    lastSummary = summary;
}

std::optional<std::string> crashSummary()
{
    std::lock_guard<std::mutex> lock(summaryMutex);
    return lastSummary;
}

toolbox::IssueReport crashReport(const toolbox::IssueReport &environment,
                                 const std::string &summary, const std::string &logTail)
{
    toolbox::IssueReport report = environment;
    report.attachments.insert(report.attachments.begin(), {"What happened", summary});
    if (!logTail.empty())
    {
        // Keep the newest lines when the tail is over budget.
        std::string log       = logTail.size() > kCrashReportLogBytes
                                    ? logTail.substr(logTail.size() - kCrashReportLogBytes)
                                    : logTail;
        size_t      firstLine = logTail.size() > kCrashReportLogBytes ? log.find('\n') : 0;
        if (firstLine != std::string::npos && firstLine > 0)
        {
            log = log.substr(firstLine + 1);
        }
        report.attachments.emplace_back("Previous launch log", log);
    }
    return report;
}
}
