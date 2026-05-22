package com.aicalendar.widget.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.aicalendar.widget.api.ApiClient
import com.aicalendar.widget.store.TokenStore
import com.aicalendar.widget.widgets.TimeFmt
import java.time.OffsetDateTime

object ReminderScheduler {

    private fun pendingIntent(context: Context, code: Int, title: String?, text: String?): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ReminderReceiver.ACTION + ":" + code // unique action so cancel matches by code
            if (title != null) putExtra(ReminderReceiver.EXTRA_TITLE, title)
            if (text != null) putExtra(ReminderReceiver.EXTRA_TEXT, text)
            putExtra(ReminderReceiver.EXTRA_NOTIF_ID, code)
        }
        return PendingIntent.getBroadcast(
            context, code, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    /** Pull upcoming events and (re)schedule an exact alarm per reminder. */
    suspend fun sync(context: Context) {
        val token = TokenStore.get(context) ?: return
        val resp = runCatching { ApiClient.reminders(token) }.getOrNull() ?: return
        val am = context.getSystemService(AlarmManager::class.java) ?: return
        ReminderReceiver.ensureChannel(context)

        // Cancel previously scheduled alarms.
        val oldCodes = TokenStore.getAlarmCodes(context)
        oldCodes.forEach { code ->
            am.cancel(pendingIntent(context, code, null, null))
        }

        val now = System.currentTimeMillis()
        val newCodes = mutableSetOf<Int>()

        for (e in resp.events) {
            val startMs = runCatching { OffsetDateTime.parse(e.start_time).toInstant().toEpochMilli() }.getOrNull() ?: continue
            for (r in e.reminders) {
                val triggerAt = startMs - r.minutes_before * 60_000L
                if (triggerAt <= now) continue
                val code = ("${e.id}:${r.minutes_before}").hashCode()
                val whenText = TimeFmt.short(e.start_time)
                val loc = e.location_text?.takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""
                val text = "$whenText 시작${beforeLabel(r.minutes_before)}$loc"
                val pi = pendingIntent(context, code, e.title, text)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
                    } else {
                        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
                    }
                    newCodes.add(code)
                } catch (_: SecurityException) {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
                    newCodes.add(code)
                }
            }
        }

        TokenStore.saveAlarmCodes(context, newCodes)
    }

    private fun beforeLabel(min: Int): String = when {
        min <= 0 -> ""
        min < 60 -> " ${min}분 전"
        min < 1440 -> " ${min / 60}시간 전"
        else -> " ${min / 1440}일 전"
    }
}
