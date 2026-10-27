#pragma once

#include <string>

namespace loader::alerts {
constexpr double kCountdownTickSeconds   = 1.0;
constexpr double kCountdownLeewaySeconds = 0.1;

struct CountdownFrame {
    std::string title;
    bool        buttonsEnabled = true;
    bool        running        = false;
};

std::string countdownTitle(const std::string &title, long remaining);

class Countdown
{
public:
    Countdown(std::string title, long seconds);

    CountdownFrame frame() const;
    CountdownFrame tick(bool presented);

private:
    std::string title_;
    long        remaining_ = 0;
    bool        running_   = false;
};
}
