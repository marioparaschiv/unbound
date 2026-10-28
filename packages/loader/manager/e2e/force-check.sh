#!/usr/bin/env bash
# Usage: force-check.sh <hours-ahead>, larger on each run (12, 24, 36, ...). Needs `adb root`.
#
# WorkManager refuses a forced run "before schedule", so the device clock moves past the 6-hour period
# first. JobScheduler's latency counts elapsed time, which `run -f` skips.
set -euo pipefail

hours=${1:?usage: force-check.sh <hours-ahead>}
adb=$(command -v adb || echo "${ANDROID_HOME:-$HOME/android-sdk}/platform-tools/adb")
db=/data/data/app.unbound.manager/no_backup/androidx.work.workdb
query="select s.system_id from SystemIdInfo s join WorkSpec w on w.id = s.work_spec_id where w.worker_class_name like '%CheckWorker'"

job=$("$adb" shell "sqlite3 $db \"$query\"" | tr -d '\r')
if [[ -z $job ]]; then
	echo "no CheckWorker job: open the manager once so it schedules the check" >&2
	exit 1
fi
echo "check job id: $job"

"$adb" shell settings put global auto_time 0
"$adb" shell date "@$(($(date +%s) + hours * 3600))" >/dev/null
echo "device clock: $("$adb" shell date)"
"$adb" logcat -c
"$adb" shell cmd jobscheduler run -f -n androidx.work.systemjobscheduler app.unbound.manager "$job"

# The clock is restored only after the worker ends: WorkManager reschedules everything on TIME_SET.
status=0
timeout 120 "$adb" logcat -v time -m 1 -e 'Worker result .*app\.unbound\.manager\.CheckWorker|Delaying execution for app\.unbound\.manager\.CheckWorker' ||
	{
		echo "no CheckWorker result within 120 s" >&2
		status=1
	}

"$adb" shell date "@$(date +%s)" >/dev/null
"$adb" shell settings put global auto_time 1
echo "device clock restored: $("$adb" shell date)"
exit $status
