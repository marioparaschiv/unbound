#include <atomic>
#include <cassert>
#include <chrono>
#include <thread>
#include <vector>

#include "NativeWorkQueue.h"

int main()
{
    loader::native::NativeWorkQueue<int> queue;
    assert(queue.enqueue(1));
    assert(!queue.enqueue(2));
    assert(!queue.enqueue(3));
    auto             now = std::chrono::steady_clock::time_point{};
    std::vector<int> observed;
    bool             remaining = queue.drain(
        [&](int value) {
            observed.push_back(value);
            now += std::chrono::milliseconds(2);
        },
        [&] {
            return now;
        });
    assert(remaining);
    assert((observed == std::vector<int>{1}));
    assert(queue.size() == 2);
    assert(!queue.enqueue(4, loader::native::NativeWorkPriority::Critical));
    remaining = queue.drain(
        [&](int value) {
            observed.push_back(value);
            now += std::chrono::milliseconds(2);
        },
        [&] {
            return now;
        });
    assert(remaining);
    assert((observed == std::vector<int>{1, 4}));
    assert(queue.drain(
               [&](int value) {
                   observed.push_back(value);
               },
               [&] {
                   return now;
               }) == false);
    assert((observed == std::vector<int>{1, 4, 2, 3}));
    assert(queue.size() == 0);
    assert(queue.enqueue(5));
    assert(!queue.drain(
        [&](int value) {
            observed.push_back(value);
        },
        [&] {
            return now;
        }));
    assert(observed.back() == 5);

    assert(queue.enqueue(6));
    assert(queue.drain(
               [&](int value) {
                   observed.push_back(value);
                   if (value == 6)
                   {
                       assert(!queue.enqueue(7, loader::native::NativeWorkPriority::Critical));
                   }
                   now += std::chrono::milliseconds(2);
               },
               [&] {
                   return now;
               },
               std::chrono::milliseconds(0)) == false);
    assert((observed == std::vector<int>{1, 4, 2, 3, 5, 6, 7}));

    assert(queue.enqueue(8));
    queue.retryScheduling();
    assert(queue.enqueue(9));
    assert(!queue.drain(
        [&](int value) {
            observed.push_back(value);
        },
        [&] {
            return now;
        }));
    assert((observed == std::vector<int>{1, 4, 2, 3, 5, 6, 7, 8, 9}));

    loader::native::NativeWorkQueue<int> concurrent;
    std::atomic_int                      wakeups{0};
    std::vector<std::thread>             producers;
    for (int producer = 0; producer < 4; producer++)
    {
        producers.emplace_back([&, producer] {
            for (int index = 0; index < 100; index++)
            {
                if (concurrent.enqueue(producer * 100 + index))
                {
                    wakeups.fetch_add(1);
                }
            }
        });
    }
    for (auto &producer : producers)
    {
        producer.join();
    }
    assert(wakeups.load() == 1);
    assert(concurrent.size() == 400);
    std::vector<int> counts(400);
    assert(!concurrent.drain(
        [&](int value) {
            counts.at(value)++;
        },
        [&] {
            return now;
        }));
    for (int count : counts)
    {
        assert(count == 1);
    }
    assert(concurrent.enqueue(400));

    loader::native::NativeWorkQueue<int> coalesced;
    std::vector<int>                     latest;
    assert(coalesced.enqueueCoalesced("hook-1:receiver-1", 1));
    assert(!coalesced.enqueueCoalesced("hook-1:receiver-1", 2));
    assert(!coalesced.enqueueCoalesced("hook-1:receiver-2", 3));
    assert(coalesced.size() == 2);
    assert(!coalesced.drain(
        [&](int value) {
            latest.push_back(value);
        },
        [&] {
            return now;
        }));
    assert((latest == std::vector<int>{2, 3}));

    assert(coalesced.enqueueCoalesced("hook-1:receiver-1", 4));
    assert(coalesced.drain(
               [&](int value) {
                   latest.push_back(value);
               },
               [&] {
                   return now;
               }) == false);
    assert(latest.back() == 4);
}
