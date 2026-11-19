#include <cassert>
#include <cerrno>

#include "LoaderDiskFull.h"
#include "LoaderLaunchReport.h"

static void ignoresOtherFailures()
{
    loader::clearDiskFullNote();
    loader::noteWriteFailure(EACCES, "/data/Unbound/settings.json", 1);
    loader::noteWriteFailure(EIO, "/data/Unbound/settings.json", 2);
    assert(!loader::diskFullNote());
}

static void notesTheLatestFullWrite()
{
    loader::clearDiskFullNote();
    loader::noteWriteFailure(ENOSPC, "/data/Unbound/settings.json", 10);
    loader::noteWriteFailure(EDQUOT, "/data/Unbound/Plugins/a/bundle.js", 20);

    auto note = loader::diskFullNote();
    assert(note);
    assert(note->at == 20);
    assert(note->file == "bundle.js");
}

static void reportsItInTheLaunchReport()
{
    loader::clearDiskFullNote();
    assert(!loader::launchReportJSON(loader::launchReport(), "", {}).contains("diskFull"));

    loader::noteWriteFailure(ENOSPC, "/data/Unbound/settings.json", 30);
    auto json = loader::launchReportJSON(loader::launchReport(), "", {});
    assert(json["diskFull"]["at"] == 30);
    assert(json["diskFull"]["file"] == "settings.json");
}

int main()
{
    ignoresOtherFailures();
    notesTheLatestFullWrite();
    reportsItInTheLaunchReport();
    return 0;
}
