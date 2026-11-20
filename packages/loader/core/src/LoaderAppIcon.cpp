#include "LoaderAppIcon.h"

#include <cmath>

namespace loader::appicon {
constexpr int kFirstConfirmingOS = 27;

IconRequest IconChangeQueue::request(uint64_t id)
{
    if (!busy_)
    {
        busy_ = true;
        return {true, std::nullopt};
    }

    std::optional<uint64_t> superseded = pending_;
    pending_                           = id;
    return {false, superseded};
}

std::optional<uint64_t> IconChangeQueue::finish()
{
    std::optional<uint64_t> next = pending_;
    pending_.reset();
    busy_ = next.has_value();
    return next;
}

bool IconChangeQueue::cancel(uint64_t id)
{
    if (pending_ != id)
    {
        return false;
    }

    pending_.reset();
    return true;
}

bool IconChangeQueue::busy() const
{
    return busy_;
}

size_t frameAt(const std::vector<double> &durationsMs, double elapsedSeconds)
{
    if (durationsMs.empty())
    {
        return 0;
    }

    double total = 0;
    for (double duration : durationsMs)
    {
        total += duration / 1000.0;
    }

    double position = total > 0 ? std::fmod(elapsedSeconds, total) : 0;
    for (size_t index = 0; index < durationsMs.size(); ++index)
    {
        position -= durationsMs[index] / 1000.0;
        if (position < 0)
        {
            return index;
        }
    }

    return durationsMs.size() - 1;
}

bool changesNeedConfirmation(int osMajor, bool seenOnThisVersion)
{
    return osMajor >= kFirstConfirmingOS || seenOnThisVersion;
}

bool canAnimate(bool hasFrames, bool springBoardAnimates, bool changesNeedConfirmation)
{
    return hasFrames && (springBoardAnimates || !changesNeedConfirmation);
}
}
