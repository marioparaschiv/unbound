#include <cassert>
#include <filesystem>
#include <string>

#include "LoaderCrashHandler.h"
#include "LoaderExitRecord.h"
#include "LoaderFiles.h"

using namespace loader;

int main()
{
    std::filesystem::path root =
        std::filesystem::temp_directory_path() / "unbound-exit-record-test";
    std::filesystem::remove_all(root);
    std::filesystem::create_directories(root);
    ExitRecord record(root.string());

    assert(record.take(false) == PreviousExit::Unknown);

    assert(record.markEnded());
    assert(record.take(false) == PreviousExit::Ended);
    assert(record.take(false) == PreviousExit::Unknown);

    assert(record.markEnded());
    assert(record.clear());
    assert(record.take(false) == PreviousExit::Unknown);

    assert(record.markEnded());
    assert(record.take(true) == PreviousExit::Crashed);
    assert(record.take(false) == PreviousExit::Unknown);

    assert(!nativeCrashRecorded(root.string()));
    assert(writeTextFileAtomically((root / kNativeCrashFile).string(), ""));
    assert(!nativeCrashRecorded(root.string()));
    assert(writeTextFileAtomically((root / kNativeCrashFile).string(), "Signal 11\n"));
    assert(nativeCrashRecorded(root.string()));

    std::filesystem::remove_all(root);
    return 0;
}
