#include <cassert>
#include <filesystem>
#include <string>

#include "LoaderCrashReport.h"
#include "LoaderFiles.h"
#include "LoaderLogFile.h"

int main()
{
    assert(!loader::crashSummary());
    loader::recordCrashSummary("Discord closed during startup.");
    assert(loader::crashSummary() == "Discord closed during startup.");

    loader::toolbox::IssueReport environment{
        "iOS", {{"Unbound", "loader 1.0.0"}}, {{"Entitlements", "x"}}};
    std::string log(6000, 'a');
    log += "\nlast line\n";
    loader::toolbox::IssueReport report =
        loader::crashReport(environment, "Discord closed during startup.", log);
    assert(report.attachments.front().first == "What happened");
    assert(report.attachments.back().first == "Previous launch log");
    assert(report.attachments.back().second == "last line\n");
    assert(loader::toolbox::issueBody(report).find("Discord closed during startup.") !=
           std::string::npos);

    // The tail is what the log held before this launch opened it.
    std::string directory =
        (std::filesystem::temp_directory_path() / "loader-crash-report").string();
    std::filesystem::remove_all(directory);
    std::string lines;
    for (int index = 0; index < 50; index++)
    {
        lines += "line " + std::to_string(index) + "\n";
    }
    assert(loader::writeTextFileAtomically(
        loader::logFileDirectory(directory) + "/" + loader::kLogFileName, lines));
    loader::openLogFile(directory);
    loader::appendLogFile(loader::LogLevel::Info, "test", "this launch");
    std::string tail = loader::previousLaunchLogTail(3);
    assert(tail == "line 47\nline 48\nline 49\n");
    std::filesystem::remove_all(directory);
    return 0;
}
