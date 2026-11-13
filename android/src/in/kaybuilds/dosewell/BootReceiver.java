package in.kaybuilds.dosewell;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Puts reminders back after the phone restarts, the app updates, or the clock changes. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent in) {
        if (in == null || in.getAction() == null) return;
        try { Alarms.rearm(c); } catch (Exception ignored) { }
    }
}
