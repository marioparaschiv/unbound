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
                                 const std::string &summary, const std::string &logTail,
                                 const std::string &nativeStack)
{
    toolbox::IssueReport report = environment;
    report.attachments.insert(report.attachments.begin(), {"What happened", summary});
    if (!nativeStack.empty())
    {
        report.attachments.emplace_back("Native stack", nativeStack);
    }
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

static toolbox::IssueReport withoutEntitlements(const toolbox::IssueReport &environment)
{
    toolbox::IssueReport report = environment;
    std::erase_if(report.attachments, [](const auto &attachment) {
        return attachment.first == "Entitlements";
    });
    return report;
}

static void dropOldestLine(std::string &log)
{
    size_t newline = log.find('\n');
    log.erase(0, newline == std::string::npos ? log.size() : newline + 1);
}

std::string crashReportURL(const toolbox::IssueReport &environment, const std::string &summary,
                           const std::string &logTail, const std::string &nativeStack)
{
    const toolbox::IssueReport base  = withoutEntitlements(environment);
    std::string                log   = logTail;
    std::string                stack = nativeStack;
    std::string                url   = toolbox::issueURL(crashReport(base, summary, log, stack));
    // The log goes first; the stack's innermost frames matter most, so it loses its outermost.
    while (url.size() > kCrashReportURLLength && (!log.empty() || !stack.empty()))
    {
        if (!log.empty())
        {
            dropOldestLine(log);
        }
        else
        {
            size_t last = stack.find_last_of('\n', stack.size() >= 2 ? stack.size() - 2 : 0);
            stack.erase(last == std::string::npos ? 0 : last + 1);
        }
        url = toolbox::issueURL(crashReport(base, summary, log, stack));
    }
    return url;
}
}
