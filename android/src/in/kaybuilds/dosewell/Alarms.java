package in.kaybuilds.dosewell;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/** Schedules dose reminders with AlarmManager and remembers them so they survive a restart. */
final class Alarms {
    static final String CHANNEL = "dose_reminders";
    static final String PREFS = "dosewell_native";
    static final String ACT_FIRE = "in.kaybuilds.dosewell.FIRE";
    static final String ACT_TAKEN = "in.kaybuilds.dosewell.TAKEN";
    static final String ACT_SNOOZE = "in.kaybuilds.dosewell.SNOOZE";
    static final int MAX = 450;

    private Alarms() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static void ensureChannel(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, c.getString(R.string.channel_name), NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription(c.getString(R.string.channel_desc));
        ch.enableVibration(true);
        ch.enableLights(true);
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
        nm.createNotificationChannel(ch);
    }

    static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    private static PendingIntent pending(Context c, JSONObject o, int flags) {
        int id = o.optInt("id");
        Intent i = new Intent(c, AlarmReceiver.class).setAction(ACT_FIRE).setData(Uri.parse("dosewell://fire/" + id));
        i.putExtra("id", id).putExtra("title", o.optString("title")).putExtra("body", o.optString("body"))
            .putExtra("d", o.optString("d")).putExtra("k", o.optString("k")).putExtra("fu", o.optInt("fu", 0))
            .putExtra("futitle", o.optString("futitle")).putExtra("plain", o.optBoolean("plain", false));
        return PendingIntent.getBroadcast(c, id, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    static void arm(Context c, JSONObject o) {
        long at = o.optLong("at");
        if (at <= System.currentTimeMillis()) return;
        setAlarm(c, at, pending(c, o, PendingIntent.FLAG_UPDATE_CURRENT));
    }

    static void setAlarm(Context c, long at, PendingIntent pi) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null || pi == null) return;
        try {
            if (canExact(c)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (SecurityException e) {
            try { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi); } catch (Exception ignored) { }
        }
    }

    private static void cancelList(Context c, JSONArray list) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int n = 0; n < list.length(); n++) {
            JSONObject o = list.optJSONObject(n);
            if (o == null) continue;
            PendingIntent pi = pending(c, o, PendingIntent.FLAG_NO_CREATE);
            if (pi != null) { am.cancel(pi); pi.cancel(); }
        }
    }

    static JSONArray stored(Context c) {
        try { return new JSONArray(prefs(c).getString("alarms", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    /** Replace every scheduled reminder with the given list. */
    static synchronized void replaceAll(Context c, String json) {
        JSONArray next;
        try { next = new JSONArray(json); } catch (Exception e) { return; }
        cancelList(c, stored(c));
        JSONArray keep = new JSONArray();
        for (int n = 0; n < next.length() && keep.length() < MAX; n++) {
            JSONObject o = next.optJSONObject(n);
            if (o == null || o.optInt("id") <= 0 || o.optLong("at") <= 0) continue;
            keep.put(o);
        }
        prefs(c).edit().putString("alarms", keep.toString()).apply();
        for (int n = 0; n < keep.length(); n++) arm(c, keep.optJSONObject(n));
    }

    /** Put stored reminders back after a restart, an app update or a clock change. */
    static synchronized void rearm(Context c) {
        JSONArray list = stored(c);
        for (int n = 0; n < list.length(); n++) { JSONObject o = list.optJSONObject(n); if (o != null) arm(c, o); }
    }

    static synchronized void cancelAll(Context c) {
        cancelList(c, stored(c));
        prefs(c).edit().putString("alarms", "[]").apply();
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancelAll();
    }

    /** Remember a dose marked from the notification; the app applies it the next time it opens. */
    static synchronized void addPending(Context c, String d, String k, String hhmm) {
        try {
            JSONArray a = new JSONArray(prefs(c).getString("pending", "[]"));
            if (a.length() > 500) return;
            a.put(new JSONObject().put("d", d).put("k", k).put("t", hhmm));
            prefs(c).edit().putString("pending", a.toString()).commit();
        } catch (Exception ignored) { }
    }

    static synchronized String takePending(Context c) {
        String s = prefs(c).getString("pending", "[]");
        prefs(c).edit().putString("pending", "[]").commit();
        return s;
    }
}
