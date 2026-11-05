package app.unbound.android

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import org.json.JSONObject
import java.io.File
import java.io.FilterInputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.zip.GZIPInputStream

/**
 * Installs another patched Discord build over this one through PackageInstaller, from inside Discord.
 * JavaScript reaches it as `NativePlatform.android.installer`; every call takes and returns JSON text.
 */
object DiscordInstaller {
    private const val ACTION_RESULT = "app.unbound.android.INSTALL_RESULT"
    private const val CONNECT_TIMEOUT_MS = 15_000
    private const val READ_TIMEOUT_MS = 30_000
    private const val BUFFER_SIZE = 256 * 1024
    private const val STAGING_DIRECTORY = "unbound-install"

    private enum class Phase(val id: String) {
        IDLE("idle"),
        DOWNLOADING("downloading"),
        INSTALLING("installing"),
        CONFIRMING("confirming"),
        FAILED("failed"),
    }

    private val lock = Any()

    @Volatile private var phase = Phase.IDLE

    @Volatile private var downloaded = 0L

    @Volatile private var total = 0L

    @Volatile private var failure: String? = null

    @Volatile private var cancelled = false

    @Volatile private var sessionId = -1

    private var receiverRegistered = false
    private var installedCache: Pair<String, Map<String, String?>>? = null

    @JvmStatic
    fun call(action: String, argument: String?): String? = runCatching {
        when (action) {
            "status" -> status().toString()
            "installed-splits" -> JSONObject(installedSplits()).toString()
            "request-permission" -> requestPermission().toString()
            "install" -> install(argument.orEmpty()).toString()
            "progress" -> progress().toString()
            "cancel" -> cancel().toString()
            else -> null
        }
    }.onFailure { Logger.error(LogCategory.UPDATER, "Failed to run installer action $action", it) }.getOrNull()

    private fun context(): Context = Platform.application() ?: error("Discord's application is not ready")

    private fun packageInfo(context: Context): PackageInfo =
        context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)

    /** Reads the installed manifest through PackageManager: in-process, LSPatch swaps its component factory back to Discord's. */
    private fun availability(context: Context): String {
        val info = packageInfo(context)
        if (info.applicationInfo?.appComponentFactory?.contains("lspatch", ignoreCase = true) != true) return "unpatched"
        if (info.requestedPermissions?.contains(Manifest.permission.REQUEST_INSTALL_PACKAGES) != true) return "unsupported"
        return if (context.packageManager.canRequestPackageInstalls()) "ready" else "needs-permission"
    }

    private fun status(): JSONObject {
        val context = context()
        return JSONObject()
            .put("availability", availability(context))
            .put("versionName", packageInfo(context).versionName.orEmpty())
            .put("splits", org.json.JSONArray(installedPaths(context).keys.toList()))
    }

    /**
     * Installed split names mapped to their APK paths; base is always present. LSPatch redirects this process's
     * opens of base.apk to the stock APK it keeps, so base is read through a `/./` path its redirect does not match.
     */
    private fun installedPaths(context: Context): Map<String, String> {
        val info = context.packageManager.getApplicationInfo(context.packageName, 0)
        val names = info.splitNames.orEmpty()
        val paths = info.splitSourceDirs.orEmpty()
        val base = File(info.sourceDir)
        return mapOf("base" to "${base.parent}/./${base.name}") + names.zip(paths).toMap()
    }

    /** SHA-256 of each installed split APK, null where it cannot be read. Cached until the install changes. */
    private fun installedSplits(): Map<String, String?> {
        val paths = installedPaths(context())
        val key = paths.values.joinToString("|") { "$it:${File(it).lastModified()}" }
        synchronized(lock) { installedCache?.takeIf { it.first == key }?.let { return it.second } }
        val hashes = paths.mapValues { (_, path) -> runCatching { sha256(File(path)) }.getOrNull() }
        synchronized(lock) { installedCache = key to hashes }
        return hashes
    }

    private fun requestPermission(): Boolean {
        val context = context()
        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
        return launch(intent)
    }

    private fun launch(intent: Intent): Boolean {
        val activity = ActivityTracker.currentActivity()
        if (activity != null) {
            activity.runOnUiThread { runCatching { activity.startActivity(intent) } }
            return true
        }
        context().startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        return true
    }

    private fun progress(): JSONObject = JSONObject()
        .put("phase", phase.id)
        .put("downloaded", downloaded)
        .put("total", total)
        .put("error", failure ?: JSONObject.NULL)

    private fun cancel(): Boolean {
        cancelled = true
        val id = sessionId
        if (id >= 0) runCatching { context().packageManager.packageInstaller.abandonSession(id) }
        synchronized(lock) {
            if (phase != Phase.DOWNLOADING && phase != Phase.INSTALLING) {
                phase = Phase.IDLE
                failure = null
            }
        }
        return true
    }

    /** Starts installing the build whose splits [splitsJSON] lists; false when an install is already running. */
    private fun install(splitsJSON: String): Boolean {
        val splits = DiscordInstallPlan.parseSplits(splitsJSON)
        synchronized(lock) {
            if (phase == Phase.DOWNLOADING || phase == Phase.INSTALLING) return false
            phase = Phase.DOWNLOADING
            downloaded = 0
            total = 0
            failure = null
            cancelled = false
            sessionId = -1
        }
        Thread({ runInstall(splits) }, "unbound-discord-install").apply { isDaemon = true }.start()
        return true
    }

    private fun runInstall(splits: List<BuildSplit>) {
        val context = context()
        val staging = File(context.cacheDir, STAGING_DIRECTORY).apply {
            deleteRecursively()
            mkdirs()
        }
        try {
            val plan = DiscordInstallPlan.plan(installedSplits(), splits)
            require(plan.downloads.isNotEmpty()) { "This build is already installed" }
            total = plan.downloadBytes
            val files = plan.downloads.map { split -> split to download(split, File(staging, "${split.name}.apk")) }
            phase = Phase.INSTALLING
            commit(context, files, plan.inherit)
        } catch (error: Throwable) {
            staging.deleteRecursively()
            if (cancelled) {
                phase = Phase.IDLE
                return
            }
            Logger.error(LogCategory.UPDATER, "Failed to install the Discord build", error)
            failure = error.message ?: error::class.java.simpleName
            phase = Phase.FAILED
        }
    }

    private fun download(split: BuildSplit, destination: File): File {
        val connection = URL(split.url).openConnection() as HttpURLConnection
        connection.connectTimeout = CONNECT_TIMEOUT_MS
        connection.readTimeout = READ_TIMEOUT_MS
        connection.useCaches = false
        try {
            if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                throw IOException("Downloading split ${split.name} returned HTTP ${connection.responseCode}")
            }
            val digest = MessageDigest.getInstance("SHA-256")
            var written = 0L
            GZIPInputStream(CountingStream(connection.inputStream), BUFFER_SIZE).use { input ->
                destination.outputStream().use { output ->
                    val buffer = ByteArray(BUFFER_SIZE)
                    while (true) {
                        if (cancelled) throw IOException("Cancelled")
                        val count = input.read(buffer)
                        if (count < 0) break
                        digest.update(buffer, 0, count)
                        output.write(buffer, 0, count)
                        written += count
                    }
                }
            }
            val hash = digest.digest().joinToString("") { "%02x".format(it) }
            if (written != split.size || hash != split.sha256) {
                throw IOException("Split ${split.name} failed verification")
            }
            return destination
        } finally {
            connection.disconnect()
        }
    }

    private class CountingStream(input: InputStream) : FilterInputStream(input) {
        override fun read(): Int = super.read().also { if (it >= 0) downloaded += 1 }

        override fun read(buffer: ByteArray, offset: Int, length: Int): Int =
            super.read(buffer, offset, length).also { if (it > 0) downloaded += it }
    }

    private fun commit(context: Context, files: List<Pair<BuildSplit, File>>, inherit: Boolean) {
        val installer = context.packageManager.packageInstaller
        val mode = if (inherit) PackageInstaller.SessionParams.MODE_INHERIT_EXISTING else PackageInstaller.SessionParams.MODE_FULL_INSTALL
        val params = PackageInstaller.SessionParams(mode).apply {
            setAppPackageName(context.packageName)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
            }
        }
        val id = installer.createSession(params)
        sessionId = id
        installer.openSession(id).use { session ->
            for ((split, file) in files) {
                if (cancelled) throw IOException("Cancelled")
                file.inputStream().use { input ->
                    session.openWrite("${split.name}.apk", 0, file.length()).use { output ->
                        input.copyTo(output, BUFFER_SIZE)
                        session.fsync(output)
                    }
                }
                file.delete()
            }
            registerReceiver(context)
            val intent = Intent(ACTION_RESULT).setPackage(context.packageName)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
            session.commit(PendingIntent.getBroadcast(context, id, intent, flags).intentSender)
        }
        Logger.info(LogCategory.UPDATER, "Committed install session $id with ${files.size} splits, inherit=$inherit")
    }

    private fun registerReceiver(context: Context) {
        synchronized(lock) {
            if (receiverRegistered) return
            val filter = IntentFilter(ACTION_RESULT)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(ResultReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                context.registerReceiver(ResultReceiver, filter)
            }
            receiverRegistered = true
        }
    }

    private object ResultReceiver : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
            val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
            Logger.info(
                LogCategory.UPDATER,
                "Install session ${intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1)} reported status $status: $message",
            )
            when (status) {
                PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                    @Suppress("DEPRECATION")
                    val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                    phase = Phase.CONFIRMING
                    if (confirm != null) launch(confirm)
                }

                PackageInstaller.STATUS_SUCCESS -> phase = Phase.IDLE

                PackageInstaller.STATUS_FAILURE_ABORTED -> {
                    phase = Phase.IDLE
                    sessionId = -1
                }

                else -> {
                    failure = message ?: "The install failed with status $status"
                    phase = Phase.FAILED
                    sessionId = -1
                }
            }
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(BUFFER_SIZE)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
