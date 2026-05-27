package com.aicalendar.widget.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.aicalendar.widget.BuildConfig
import com.aicalendar.widget.R

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "일정 알림"
        val text = intent.getStringExtra(EXTRA_TEXT) ?: ""
        val notifId = intent.getIntExtra(EXTRA_NOTIF_ID, title.hashCode())
        show(context, title, text, notifId)

        // Hold wake lock while we play through the alarm stream so the
        // sound actually plays on Samsung where notification volume is
        // usually muted but alarm volume is loud.
        val pending = goAsync()
        val r = ringOnAlarmStream(context)
        Handler(Looper.getMainLooper()).postDelayed({
            runCatching { r?.stop() }
            pending.finish()
        }, RING_MS)
    }

    companion object {
        const val ACTION = "com.aicalendar.widget.REMINDER_FIRE"
        const val EXTRA_TITLE = "title"
        const val EXTRA_TEXT = "text"
        const val EXTRA_NOTIF_ID = "notifId"

        private const val RING_MS = 6_000L

        /** Post the alarm notification now. Used by the receiver and the test button. */
        fun show(context: Context, title: String, text: String, notifId: Int) {
            ensureChannel(context)
            val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.WEB_BASE_URL + "/calendar"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val contentPi = PendingIntent.getActivity(
                context, notifId, openIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(contentPi)
            try {
                NotificationManagerCompat.from(context).notify(notifId, builder.build())
            } catch (_: SecurityException) {
                // POST_NOTIFICATIONS not granted.
            }
        }

        /**
         * Channel v3: SILENT + vibrating. Sound is played explicitly through the
         * ALARM audio stream in onReceive() so it's audible on Samsung One UI,
         * where USAGE_NOTIFICATION routes to the notification volume slider
         * (almost always muted while alarm volume is loud).
         */
        const val CHANNEL_ID = "event_alarms_v3"

        /** Play the default alarm sound through the ALARM stream. */
        fun ringOnAlarmStream(context: Context): Ringtone? {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                ?: return null
            return runCatching {
                val r = RingtoneManager.getRingtone(context, uri) ?: return null
                r.audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    r.isLooping = true
                }
                r.play()
                r
            }.getOrNull()
        }

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val mgr = context.getSystemService(NotificationManager::class.java)
                // Drop legacy channels so users don't see orphaned entries
                // in app notification settings.
                runCatching { mgr.deleteNotificationChannel("event_alarms_v1") }
                runCatching { mgr.deleteNotificationChannel("event_alarms_v2") }
                if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
                    val ch = NotificationChannel(
                        CHANNEL_ID,
                        "일정 알림",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "예정된 일정 알림 (알람 볼륨으로 울림)"
                        setSound(null, null)
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 500, 300, 500)
                    }
                    mgr.createNotificationChannel(ch)
                }
            }
        }
    }
}
