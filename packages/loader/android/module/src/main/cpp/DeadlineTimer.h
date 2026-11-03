#pragma once

#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <thread>
#include <utility>
#include <vector>

namespace unbound::android {
class DeadlineTimer
{
public:
    using Clock = std::chrono::steady_clock;

    DeadlineTimer()                                 = default;
    DeadlineTimer(const DeadlineTimer &)            = delete;
    DeadlineTimer &operator=(const DeadlineTimer &) = delete;

    ~DeadlineTimer()
    {
        {
            std::lock_guard<std::mutex> lock(state_->mutex);
            state_->stopping = true;
            state_->deadlines.clear();
        }
        state_->wake.notify_all();
    }

    void schedule(Clock::duration delay, std::function<void()> work)
    {
        {
            std::lock_guard<std::mutex> lock(state_->mutex);
            if (state_->stopping)
            {
                return;
            }
            state_->deadlines.push_back(
                {Clock::now() + delay, state_->sequence++, std::move(work)});
            std::push_heap(state_->deadlines.begin(), state_->deadlines.end(), Later{});
            if (!state_->running)
            {
                state_->running = true;
                std::thread([state = state_] {
                    run(*state);
                }).detach();
            }
        }
        state_->wake.notify_one();
    }

private:
    struct Deadline {
        Clock::time_point     due;
        uint64_t              sequence;
        std::function<void()> work;
    };

    struct Later {
        bool operator()(const Deadline &left, const Deadline &right) const
        {
            return left.due != right.due ? left.due > right.due : left.sequence > right.sequence;
        }
    };

    struct State {
        mutable std::mutex      mutex;
        std::condition_variable wake;
        std::vector<Deadline>   deadlines;
        uint64_t                sequence = 0;
        bool                    running  = false;
        bool                    stopping = false;
    };

    static void run(State &state)
    {
        std::unique_lock<std::mutex> lock(state.mutex);
        while (!state.stopping)
        {
            if (state.deadlines.empty())
            {
                state.wake.wait(lock);
                continue;
            }
            const Clock::time_point due = state.deadlines.front().due;
            if (Clock::now() < due)
            {
                state.wake.wait_until(lock, due);
                continue;
            }
            std::pop_heap(state.deadlines.begin(), state.deadlines.end(), Later{});
            std::function<void()> work = std::move(state.deadlines.back().work);
            state.deadlines.pop_back();
            lock.unlock();
            work();
            work = nullptr;
            lock.lock();
        }
    }

    std::shared_ptr<State> state_ = std::make_shared<State>();
};
}
