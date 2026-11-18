#include "LoaderLogRateLimit.h"

namespace loader {
LogAdmission LogRateLimiter::admit(const std::string &scope, int64_t nowMs)
{
    std::lock_guard<std::mutex> lock(mutex);
    Window &window = windows[scope];
    LogAdmission admission;

    if (nowMs - window.start >= kLogRateWindowMs)
    {
        if (window.suppressed > 0)
        {
            admission.summary = "Suppressed " + std::to_string(window.suppressed) + " lines from "
                                + scope + " that logged more than " + std::to_string(kLogRateBudget)
                                + " in " + std::to_string(kLogRateWindowMs / 1000) + " s.";
        }

        window = {nowMs, 0, 0};
    }

    if (++window.count > kLogRateBudget)
    {
        window.suppressed++;
        admission.write = false;
    }

    return admission;
}

LogRateLimiter &jsLogRateLimiter()
{
    static LogRateLimiter limiter;
    return limiter;
}
}
