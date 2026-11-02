#pragma once

#include <chrono>
#include <cstddef>
#include <deque>
#include <mutex>
#include <optional>
#include <utility>

namespace loader::native {
enum class NativeWorkPriority
{
    Deferred,
    Critical,
};

template <typename Task> class NativeWorkQueue
{
public:
    bool enqueue(Task task, NativeWorkPriority priority = NativeWorkPriority::Deferred)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        auto &queue = priority == NativeWorkPriority::Critical ? critical_ : deferred_;
        queue.push_back(std::move(task));
        return !std::exchange(scheduled_, true);
    }

    template <typename Consumer, typename Clock>
    bool drain(Consumer consume, Clock clock,
               std::chrono::steady_clock::duration budget = std::chrono::milliseconds(2))
    {
        const auto deadline  = clock() + budget;
        bool       processed = false;
        for (;;)
        {
            std::optional<Task> task;
            {
                std::lock_guard<std::mutex> lock(mutex_);
                if (!critical_.empty())
                {
                    task.emplace(std::move(critical_.front()));
                    critical_.pop_front();
                }
                else if (!deferred_.empty() && (!processed || clock() < deadline))
                {
                    task.emplace(std::move(deferred_.front()));
                    deferred_.pop_front();
                }
                else
                {
                    scheduled_ = !deferred_.empty();
                    return scheduled_;
                }
            }
            consume(std::move(*task));
            processed = true;
        }
    }

    size_t size() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return critical_.size() + deferred_.size();
    }

    void retryScheduling()
    {
        std::lock_guard<std::mutex> lock(mutex_);
        scheduled_ = false;
    }

private:
    mutable std::mutex mutex_;
    std::deque<Task>   deferred_;
    std::deque<Task>   critical_;
    bool               scheduled_ = false;
};
}
