#pragma once

#include <string>

namespace loader {
// How the platform says the previous process ended, where it can tell.
enum class PreviousExit
{
    // No record, or a platform that cannot tell: an unfinished launch counts as a failure.
    Unknown,
    // A crash, a native signal, a freeze or a failed start.
    Crashed,
    // The person or the system ended it: swiped away, force-stopped, low memory, an update.
    Ended,
};

// What the launch guard decided about the launches before this one.
struct LaunchVerdict {
    // Launches in a row that ended before Discord ran for a while.
    int  failures      = 0;
    bool rollBack      = false;
    bool enterRecovery = false;
};

// Counts launches that ended before Discord was healthy, whatever crashed: the bundle, a theme, a
// font or the loader itself. Addon crashes have their own guard with per-addon attribution.
class LaunchGuard
{
public:
    static constexpr const char *kFile          = "launch-guard.json";
    static constexpr int         kRollBackAfter = 2;
    static constexpr int         kRecoveryAfter = 3;

    explicit LaunchGuard(std::string directory);

    // Counts an unfinished previous launch, unless the platform says it ended without a crash,
    // and arms the marker for this one.
    LaunchVerdict begin(PreviousExit previous = PreviousExit::Unknown) const;
    // Disarms the marker once this launch has run long enough to count as healthy.
    bool succeed() const;

private:
    std::string path() const;

    std::string directory_;
};

std::string launchRollBackNotice(int failures);
std::string launchRecoveryNotice(int failures);
}
