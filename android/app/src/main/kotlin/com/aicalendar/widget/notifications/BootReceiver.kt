package com.aicalendar.widget.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.aicalendar.widget.worker.RefreshWorker

// Alarms are cleared on reboot — re-schedule via a one-shot refresh.
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            WorkManager.getInstance(context).enqueue(
                OneTimeWorkRequestBuilder<RefreshWorker>().build()
            )
        }
    }
}
