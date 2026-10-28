package app.unbound.manager.effects

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import app.unbound.manager.InstallResultReceiver
import app.unbound.manager.core.Artifact
import app.unbound.manager.core.Event
import app.unbound.manager.core.Failure
import app.unbound.manager.core.Target
import java.io.File
import java.io.IOException

class Sessions(private val context: Context) {
    private val installer = context.packageManager.packageInstaller

    fun open(target: Target, artifact: Artifact, splits: File, log: (String) -> Unit): Event {
        abandonAll(target, log)

        val files = artifact.splits.map { File(splits, it) }
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(target.packageName)
            setSize(files.sumOf(File::length))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) setRequestUpdateOwnership(true)
        }
        val id = installer.createSession(params)

        try {
            installer.openSession(id).use { session ->
                for (file in files) {
                    session.openWrite(file.name, 0, file.length()).use { output ->
                        file.inputStream().use { it.copyTo(output) }
                        session.fsync(output)
                    }
                }
            }
        } catch (error: IOException) {
            installer.abandonSession(id)
            val message = error.message.orEmpty()
            return Event.Fail(if ("ENOSPC" in message) Failure.InsufficientStorage else Failure.Unexpected(message))
        }

        log("Session $id holds ${files.size} splits")
        return Event.SessionReady(id, System.currentTimeMillis())
    }

    fun commit(target: Target, sessionId: Int, log: (String) -> Unit): Event? {
        val info = installer.getSessionInfo(sessionId) ?: return Event.SessionFinished(sessionId)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && info.isCommitted) return null

        try {
            installer.openSession(sessionId).use { it.commit(resultSender(target, sessionId)) }
            log("Committed session $sessionId")
        } catch (_: IllegalStateException) {
            log("Session $sessionId was already committed")
        } catch (_: SecurityException) {
            log("Session $sessionId was already committed")
        }
        return null
    }

    fun awaitUser(sessionId: Int, held: Boolean): Event? {
        installer.getSessionInfo(sessionId) ?: return Event.SessionFinished(sessionId)

        return if (held) null else Event.Recommit
    }

    fun abandonAll(target: Target, log: (String) -> Unit) {
        for (session in installer.mySessions) {
            if (session.appPackageName != target.packageName) continue
            installer.abandonSession(session.sessionId)
            log("Abandoned session ${session.sessionId}")
        }
    }

    private fun resultSender(target: Target, sessionId: Int) = PendingIntent.getBroadcast(
        context,
        sessionId,
        Intent(context, InstallResultReceiver::class.java)
            .setAction(InstallResultReceiver.ACTION_SESSION_RESULT)
            .putExtra(InstallResultReceiver.EXTRA_TARGET, target.name),
        PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    ).intentSender
}
