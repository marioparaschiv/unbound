package app.unbound.manager.core

/** Maps a PackageInstaller status broadcast for [sessionId] to the event the reducer understands. */
fun sessionEvent(sessionId: Int, status: Int, message: String?): Event = when (status) {
    STATUS_PENDING_USER_ACTION -> Event.NeedsUser(sessionId)
    STATUS_SUCCESS -> Event.SessionFinished(sessionId)
    STATUS_FAILURE_STORAGE -> Event.Fail(Failure.InsufficientStorage, sessionId)
    else -> Event.Fail(Failure.InstallerRejected(status, message), sessionId)
}

/** PackageInstaller.STATUS_* values, duplicated so the mapping stays plain Kotlin. */
private const val STATUS_PENDING_USER_ACTION = -1
private const val STATUS_SUCCESS = 0
private const val STATUS_FAILURE_STORAGE = 6
