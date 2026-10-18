package dev.ironfist.sdk

import android.content.Context
import android.media.MediaDrm
import android.os.Build
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import java.util.UUID

class IronFistAndroid(private val context: Context) {

    fun collectTraits(): Map<String, Any> {
        val traits = mutableMapOf<String, Any>(
            "os_platform" to "android",
            "os_version" to Build.VERSION.RELEASE,
            "model" to Build.MODEL,
            "manufacturer" to Build.MANUFACTURER,
            "board" to Build.BOARD,
            "hardware_name" to Build.HARDWARE,
            "display_build" to Build.DISPLAY,
            "cpu_cores" to Runtime.getRuntime().availableProcessors(),
            "memory_gb" to 8,
            "encrypted_sp_id" to getOrCreateEncryptedStorageId()
        )

        getAndroidId()?.let { androidId ->
            traits["android_id"] = androidId
        }

        getWidevineDrmId()?.let { drmId ->
            traits["widevine_drm_id"] = drmId
        }

        return traits
    }

    private fun getAndroidId(): String? {
        return try {
            android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.ANDROID_ID
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun getWidevineDrmId(): String? {
        return try {
            val widevineUuid = UUID(-0x121074568629b532L, -0x5c37d823267d3772L)
            val mediaDrm = MediaDrm(widevineUuid)
            val widevineId = mediaDrm.getPropertyByteArray(MediaDrm.PROPERTY_DEVICE_UNIQUE_ID)
            mediaDrm.close()
            widevineId.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            null
        }
    }

    private fun getOrCreateEncryptedStorageId(): String {
        return try {
            val prefName = "ironfist_secure_prefs"
            val keyDeviceId = "device_id"
            val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            val sharedPreferences = EncryptedSharedPreferences.create(
                prefName,
                masterKeyAlias,
                context,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )

            var id = sharedPreferences.getString(keyDeviceId, null)
            if (id == null) {
                id = UUID.randomUUID().toString()
                sharedPreferences.edit().putString(keyDeviceId, id).apply()
            }
            id
        } catch (e: Exception) {
            UUID.randomUUID().toString()
        }
    }
}
