#include <atomic>
#include <cassert>
#include <chrono>
#include <condition_variable>
#include <mutex>
#include <thread>
#include <vector>

#include "DeadlineTimer.h"

using unbound::android::DeadlineTimer;
using namespace std::chrono;

static void firesInDeadlineOrder()
{
    DeadlineTimer           timer;
    std::mutex              mutex;
    std::condition_variable changed;
    std::vector<int>        order;
    auto                    record = [&](int value) {
        std::lock_guard<std::mutex> lock(mutex);
        order.push_back(value);
        changed.notify_all();
    };
    timer.schedule(milliseconds(600), [&] {
        record(4);
    });
    timer.schedule(milliseconds(200), [&] {
        record(1);
    });
    timer.schedule(milliseconds(400), [&] {
        record(2);
    });
    timer.schedule(milliseconds(400), [&] {
        record(3);
    });
    timer.schedule(milliseconds(0), [&] {
        record(0);
    });
    std::unique_lock<std::mutex> lock(mutex);
    assert(changed.wait_for(lock, seconds(5), [&] {
        return order.size() == 5;
    }));
    assert((order == std::vector<int>{0, 1, 2, 3, 4}));
}

static void wakesForEarlierDeadline()
{
    DeadlineTimer     timer;
    std::atomic<bool> early{false};
    timer.schedule(seconds(30), [] {});
    const auto start = steady_clock::now();
    timer.schedule(milliseconds(50), [&] {
        early = true;
    });
    while (!early && steady_clock::now() - start < seconds(5))
    {
        std::this_thread::sleep_for(milliseconds(5));
    }
    assert(early);
}

static void firesWhileAnotherThreadIsBlocked()
{
    DeadlineTimer     timer;
    std::atomic<bool> fired{false};
    std::mutex        stuck;
    stuck.lock();
    std::thread blockedMain([&] {
        std::lock_guard<std::mutex> lock(stuck);
    });
    const auto  start = steady_clock::now();
    timer.schedule(milliseconds(50), [&] {
        fired = true;
    });
    while (!fired && steady_clock::now() - start < seconds(5))
    {
        std::this_thread::sleep_for(milliseconds(5));
    }
    assert(fired);
    stuck.unlock();
    blockedMain.join();
}

static void dropsPendingWorkOnDestruction()
{
    std::atomic<int> count{0};
    {
        DeadlineTimer timer;
        for (int index = 0; index < 200; index++)
        {
            timer.schedule(seconds(10), [&] {
                count++;
            });
        }
    }
    std::this_thread::sleep_for(milliseconds(50));
    assert(count == 0);
}

static void acceptsConcurrentProducers()
{
    DeadlineTimer            timer;
    std::atomic<int>         count{0};
    std::vector<std::thread> producers;
    for (int producer = 0; producer < 8; producer++)
    {
        producers.emplace_back([&] {
            for (int index = 0; index < 200; index++)
            {
                timer.schedule(microseconds(index * 10), [&] {
                    count++;
                });
            }
        });
    }
    for (auto &producer : producers)
    {
        producer.join();
    }
    const auto start = steady_clock::now();
    while (count < 1600 && steady_clock::now() - start < seconds(10))
    {
        std::this_thread::sleep_for(milliseconds(5));
    }
    assert(count == 1600);
}

int main()
{
    firesInDeadlineOrder();
    wakesForEarlierDeadline();
    firesWhileAnotherThreadIsBlocked();
    dropsPendingWorkOnDestruction();
    acceptsConcurrentProducers();
}
