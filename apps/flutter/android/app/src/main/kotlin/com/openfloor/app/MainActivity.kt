package com.openfloor.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannels()
    }

    /** The channel push notifications arrive on — its id must match
     * `channelId` in the API's NativePushService. Android keeps a channel's
     * name and importance once created, so changing them later needs a new id.
     * Recreating an existing channel is a no-op. */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            "meetings",
            "Club updates",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Role assignments, confirmed speeches, new meetings and tasks"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
