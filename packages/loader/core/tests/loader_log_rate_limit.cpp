#include <cassert>
#include <string>

#include "LoaderLogRateLimit.h"

namespace {
void writesUpToTheBudgetThenSummarises()
{
    loader::LogRateLimiter limiter;

    for (int line = 0; line < loader::kLogRateBudget; line++)
    {
        assert(limiter.admit("Chatty", 1'000).write);
    }

    assert(!limiter.admit("Chatty", 1'500).write);
    assert(!limiter.admit("Chatty", 2'000).write);
    assert(limiter.admit("Quiet", 2'000).write);

    loader::LogAdmission next = limiter.admit("Chatty", 1'000 + loader::kLogRateWindowMs);
    assert(next.write);
    assert(next.summary == "Suppressed 2 lines from Chatty that logged more than 200 in 10 s.");
    assert(!limiter.admit("Chatty", 1'001 + loader::kLogRateWindowMs).summary);
}
}

int main()
{
    writesUpToTheBudgetThenSummarises();
    return 0;
}
