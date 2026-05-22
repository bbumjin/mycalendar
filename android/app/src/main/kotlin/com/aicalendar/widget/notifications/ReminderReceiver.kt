package com.aicalendar.widget.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
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
    }

    companion object {
        const val ACTION = "com.aicalendar.widget.REMINDER_FIRE"
        const val EXTRA_TITLE = "title"
        const val EXTRA_TEXT = "text"
        const val EXTRA_NOTIF_ID = "notifId"

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
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                builder.setSound(alarmSound())
            }
            try {
                NotificationManagerCompat.from(context).notify(notifId, builder.build())
            } catch (_: SecurityException) {
                // POST_NOTIFICATIONS not granted.
            }
        }
        // New channel id (channel config is immutable once created). Uses
        // USAGE_NOTIFICATION — USAGE_ALARM caused Samsung One UI to suppress the
        // whole notification when the app wasn't foreground.
        const val CHANNEL_ID = "event_alarms_v2"

        private fun alarmSound(): Uri =
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val mgr = context.getSystemService(NotificationManager::class.java)
                if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
                    val attrs = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                    val ch = NotificationChannel(
                        CHANNEL_ID,
                        "일정 알림",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "예정된 일정 알림 (소리 + 진동)"
                        setSound(alarmSound(), attrs)
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 500, 300, 500)
                    }
                    mgr.createNotificationChannel(ch)
                }
            }
        }
    }
}
