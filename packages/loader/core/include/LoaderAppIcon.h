#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <vector>

namespace loader::appicon {
struct IconRequest {
    bool startNow = false;
    std::optional<uint64_t> superseded;
};

class IconChangeQueue
{
public:
    IconRequest request(uint64_t id);
    std::optional<uint64_t> finish();
    bool cancel(uint64_t id);
    bool busy() const;

private:
    bool busy_ = false;
    std::optional<uint64_t> pending_;
};

size_t frameAt(const std::vector<double> &durationsMs, double elapsedSeconds);
bool changesNeedConfirmation(int osMajor, bool seenOnThisVersion);
bool canAnimate(bool hasFrames, bool springBoardAnimates, bool changesNeedConfirmation);
}
