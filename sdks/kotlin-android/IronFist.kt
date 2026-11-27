package dev.ironfist.sdk

import android.app.ActivityManager
import android.content.Context
import android.media.MediaDrm
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import kotlin.math.roundToInt

/**
 * IronFist Android SDK.
 *
 * Use a PUBLISHABLE key (if_pk_…). Never embed a secret key in an app.
 *
 *     val ironfist = IronFist(apiKey = "if_pk_…", baseUrl = "https://your-ironfist-url")
 *     val result = withContext(Dispatchers.IO) { ironfist.verify(context, user.id) }
 *     // Send result.verificationId to your server and confirm it there.
 *
 * Needs the INTERNET permission. [verify] blocks, so call it off the main thread.
 */
class IronFist(private val apiKey: String, baseUrl: String) {

    private val baseUrl = baseUrl.trimEnd('/')

    data class VerifyResult(
        val verificationId: String?,
        val decision: String,
        val allowed: Boolean,
        val reason: String,
        val deviceId: String?,
    )

    class ApiException(val status: Int, message: String) : Exception("IronFist error $status: $message")

    /** Asks IronFist whether [accountId] may start a trial on this device. */
    fun verify(context: Context, accountId: String, requireNoVpn: Boolean = false): VerifyResult {
        val body = JSONObject()
            .put("account_id", accountId)
            .put("hardware_traits", JSONObject(collectTraits(context)))
            .put("require_no_vpn", requireNoVpn)

        val connection = URL("$baseUrl/v1/verify").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.doOutput = true
            connection.setRequestProperty("Authorization", "Bearer $apiKey")
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            val json = try { JSONObject(text) } catch (e: Exception) { JSONObject() }

            // 429 carries a RATE_LIMITED decision in the same shape as a normal result.
            if ((status in 200..299 || status == 429) && json.has("decision")) {
                return VerifyResult(
                    verificationId = json.optString("verification_id").ifEmpty { null },
                    decision = json.getString("decision"),
                    allowed = json.optBoolean("allowed", false),
                    reason = json.optString("reason"),
                    deviceId = if (json.isNull("device_id")) null else json.optString("device_id").ifEmpty { null },
                )
            }
            val message = json.optJSONObject("error")?.optString("message") ?: "HTTP $status"
            throw ApiException(status, message)
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        private const val PREFS_NAME = "ironfist_prefs"
        private const val KEY_DEVICE_ID = "device_id"

        /**
         * Signals that identify this device. The Widevine identifier survives app
         * reinstalls and data clears; the stored token does not, and is the fallback
         * for devices without Widevine.
         */
        @JvmStatic
        fun collectTraits(context: Context): Map<String, Any> {
            val traits = mutableMapOf<String, Any>(
                "os_platform" to "android",
                "os_version" to Build.VERSION.RELEASE,
                "cpu_cores" to Runtime.getRuntime().availableProcessors(),
                "timezone" to TimeZone.getDefault().id,
                "language" to Locale.getDefault().toLanguageTag(),
                "storage_id" to getOrCreateStorageId(context),
            )

            val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            if (activityManager != null) {
                val info = ActivityManager.MemoryInfo()
                activityManager.getMemoryInfo(info)
                val gb = (info.totalMem / 1_073_741_824.0).roundToInt()
                if (gb > 0) traits["memory_gb"] = gb
            }

            val metrics = context.resources.displayMetrics
            traits["screen_resolution"] = "${metrics.widthPixels}x${metrics.heightPixels}"

            getWidevineId()?.let { traits["widevine_drm_id"] = it }
            return traits
        }

        private fun getWidevineId(): String? {
            // The Widevine UUID, edef8ba9-79d6-4ace-a3c8-27dcd51d21ed.
            val widevineUuid = UUID(-0x121074568629b532L, -0x5c37d8232ae2de13L)
            var mediaDrm: MediaDrm? = null
            return try {
                mediaDrm = MediaDrm(widevineUuid)
                val raw = mediaDrm.getPropertyByteArray(MediaDrm.PROPERTY_DEVICE_UNIQUE_ID)
                // Send a digest, not the raw DRM identifier.
                MessageDigest.getInstance("SHA-256").digest(raw).joinToString("") { "%02x".format(it) }
            } catch (e: Exception) {
                null
            } finally {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) mediaDrm?.close() else @Suppress("DEPRECATION") mediaDrm?.release()
                } catch (e: Exception) {
                    // Nothing to do: the handle is gone either way.
                }
            }
        }

        private fun getOrCreateStorageId(context: Context): String {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.getString(KEY_DEVICE_ID, null)?.let { return it }
            val id = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_DEVICE_ID, id).apply()
            return id
        }
    }
}
