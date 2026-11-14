#include "AndroidLogcat.h"

#include <algorithm>
#include <cerrno>
#include <chrono>
#include <csignal>
#include <fcntl.h>
#include <fstream>
#include <mutex>
#include <optional>
#include <sstream>
#include <string>
#include <string_view>
#include <sys/prctl.h>
#include <sys/wait.h>
#include <thread>
#include <time.h>
#include <unistd.h>

#include "LoaderLog.h"
#include "LoaderLogFile.h"
#include "LoaderLogcat.h"

namespace unbound::android {
constexpr int                       kLogcatAttempts  = 5;
constexpr std::chrono::seconds      kHealthyRun      = std::chrono::seconds(30);
constexpr std::chrono::milliseconds kFirstBackoff    = std::chrono::milliseconds(500);
constexpr long long                 kStartTimeMargin = 100;
constexpr int                       kMaximumFd       = 65536;

// When this process started, in epoch milliseconds, so the first logcat run also replays what the
// process logged before the loader opened its log file. Falls back to now.
static long long processStartTime()
{
    std::ifstream stat("/proc/self/stat");
    std::string   line;
    std::getline(stat, line);
    std::size_t name = line.rfind(')');
    if (name == std::string::npos)
    {
        return loader::logNow();
    }
    // Fields after the `(comm)` name start at field 3; `starttime` is field 22, in clock ticks.
    std::istringstream fields(line.substr(name + 1));
    std::string        field;
    for (int index = 3; index <= 22 && fields >> field; index++)
    {
    }
    long long ticks = std::strtoll(field.c_str(), nullptr, 10);
    long      rate  = sysconf(_SC_CLK_TCK);
    timespec  boot{};
    if (!fields || ticks <= 0 || rate <= 0 || clock_gettime(CLOCK_BOOTTIME, &boot) != 0)
    {
        return loader::logNow();
    }
    long long sinceBoot = static_cast<long long>(boot.tv_sec) * 1000 + boot.tv_nsec / 1000000;
    long long running   = std::max(0LL, sinceBoot - ticks * 1000 / rate);
    return loader::logNow() - running - kStartTimeMargin;
}

// Starts `logcat` for this process from `since`, writing to a pipe. Returns the child's pid, or -1.
static pid_t spawnLogcat(long long since, int &output)
{
    int pipes[2];
    if (pipe2(pipes, O_CLOEXEC) != 0)
    {
        return -1;
    }
    // Everything the child needs is built before fork: it may only make async-signal-safe calls.
    std::string pidArgument  = "--pid=" + std::to_string(getpid());
    std::string timeArgument = loader::logcatTime(since);
    const char *arguments[]  = {"/system/bin/logcat", "-v",   "epoch", "-T", timeArgument.c_str(),
                                pidArgument.c_str(),  nullptr};
    long        limit        = std::min<long>(sysconf(_SC_OPEN_MAX), kMaximumFd);
    pid_t       parent       = getpid();
    pid_t       child        = fork();
    if (child == 0)
    {
        // The reader thread waits on the child, so logcat dies with it instead of outliving the
        // app.
        prctl(PR_SET_PDEATHSIG, SIGKILL);
        if (getppid() != parent || dup2(pipes[1], STDOUT_FILENO) < 0)
        {
            _exit(127);
        }
        for (int fd = STDERR_FILENO + 1; fd < limit; fd++)
        {
            close(fd);
        }
        execv(arguments[0], const_cast<char *const *>(arguments));
        _exit(127);
    }
    close(pipes[1]);
    if (child < 0)
    {
        close(pipes[0]);
        return -1;
    }
    output = pipes[0];
    return child;
}

// Runs one logcat until it exits, appending each line it prints. Advances `since` past the last
// line read so a restart neither repeats nor skips lines.
static void readLogcat(long long &since)
{
    int   output = -1;
    pid_t child  = spawnLogcat(since, output);
    if (child < 0)
    {
        return;
    }
    std::string pending;
    char        buffer[4096];
    while (true)
    {
        ssize_t count = read(output, buffer, sizeof(buffer));
        if (count < 0 && errno == EINTR)
        {
            continue;
        }
        if (count <= 0)
        {
            break;
        }
        pending.append(buffer, static_cast<std::size_t>(count));
        std::size_t start = 0;
        for (std::size_t end = pending.find('\n'); end != std::string::npos;
             end             = pending.find('\n', start))
        {
            if (std::optional<loader::LogEntry> entry =
                    loader::logcatEntry(std::string_view(pending).substr(start, end - start)))
            {
                since = std::max(since, entry->time + 1);
                loader::appendLogEntry(std::move(*entry));
            }
            start = end + 1;
        }
        pending.erase(0, start);
    }
    close(output);
    while (waitpid(child, nullptr, 0) < 0 && errno == EINTR)
    {
    }
}

static void captureLogcat()
{
    long long since    = processStartTime();
    int       failures = 0;
    while (true)
    {
        auto started = std::chrono::steady_clock::now();
        readLogcat(since);
        // A run that lasted a while was healthy; only quick exits count toward giving up.
        failures = std::chrono::steady_clock::now() - started >= kHealthyRun ? 0 : failures + 1;
        if (failures >= kLogcatAttempts)
        {
            loader::log(loader::LogLevel::Warning, LOG_CATEGORY_DEFAULT,
                        "Failed to capture logcat for process " + std::to_string(getpid()) +
                            ": it exited " + std::to_string(failures) +
                            " times in a row, native logs stop here.");
            return;
        }
        std::this_thread::sleep_for(kFirstBackoff * (1 << failures));
    }
}

void startLogcatCapture()
{
    static std::once_flag started;
    std::call_once(started, [] {
        std::thread(captureLogcat).detach();
    });
}
}
