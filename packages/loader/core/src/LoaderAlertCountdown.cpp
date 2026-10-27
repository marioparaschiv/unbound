#include "LoaderAlertCountdown.h"

#include <utility>

namespace loader::alerts {
std::string countdownTitle(const std::string &title, long remaining)
{
    return title + " (" + std::to_string(remaining) + ")";
}

Countdown::Countdown(std::string title, long seconds)
    : title_(std::move(title)), remaining_(seconds), running_(seconds > 0)
{
}

CountdownFrame Countdown::frame() const
{
    if (!running_)
    {
        return {title_, remaining_ <= 0, false};
    }
    return {countdownTitle(title_, remaining_), false, true};
}

CountdownFrame Countdown::tick(bool presented)
{
    if (!running_)
    {
        return frame();
    }
    if (!presented)
    {
        running_ = false;
        return {countdownTitle(title_, remaining_), false, false};
    }
    remaining_--;
    if (remaining_ <= 0)
    {
        running_ = false;
    }
    return frame();
}
}
