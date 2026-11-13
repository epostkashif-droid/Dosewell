package in.kaybuilds.dosewell;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import java.util.Calendar;

/** Shows the reminder and handles its Taken and Snooze buttons without opening the app. */
public class AlarmReceiver extends BroadcastReceiver {
    private static final int FOLLOW_OFFSET = 1000000000;

    @Override
    public void onReceive(Context c, Intent in) {
        if (in == null || in.getAction() == null) return;
        String act = in.getAction();
        int id = in.getIntExtra("id", 0);
        if (id == 0) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Alarms.ACT_FIRE.equals(act)) {
            show(c, nm, in, id);
            int fu = in.getIntExtra("fu", 0);
            if (fu > 0) Alarms.setAlarm(c, System.currentTimeMillis() + fu * 60000L, follow(c, in, id, PendingIntent.FLAG_UPDATE_CURRENT));
        } else if (Alarms.ACT_TAKEN.equals(act)) {
            Calendar now = Calendar.getInstance();
            String hhmm = String.format(java.util.Locale.US, "%02d%02d", now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE));
            Alarms.addPending(c, in.getStringExtra("d"), in.getStringExtra("k"), hhmm);
            clear(c, nm, in, id);
        } else if (Alarms.ACT_SNOOZE.equals(act)) {
            clear(c, nm, in, id);
            int minutes = Alarms.prefs(c).getInt("snooze", 10);
            Intent again = copy(c, in, id, Alarms.ACT_FIRE, "dosewell://fire/" + id).putExtra("fu", 0);
            Alarms.setAlarm(c, System.currentTimeMillis() + minutes * 60000L, PendingIntent.getBroadcast(c, id, again, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
    }

    private static Intent copy(Context c, Intent in, int id, String action, String data) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction(action).setData(Uri.parse(data));
        i.putExtra("id", id).putExtra("title", in.getStringExtra("title")).putExtra("body", in.getStringExtra("body"))
            .putExtra("d", in.getStringExtra("d")).putExtra("k", in.getStringExtra("k"))
            .putExtra("futitle", in.getStringExtra("futitle")).putExtra("plain", in.getBooleanExtra("plain", false));
        return i;
    }

    /** The second nudge, sent if the dose is still not marked. */
    private static PendingIntent follow(Context c, Intent in, int id, int flags) {
        String t = in.getStringExtra("futitle");
        Intent i = copy(c, in, id, Alarms.ACT_FIRE, "dosewell://follow/" + id).putExtra("fu", 0).putExtra("follow", true);
        if (t != null && t.length() > 0) i.putExtra("title", t);
        return PendingIntent.getBroadcast(c, id, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void clear(Context c, NotificationManager nm, Intent in, int id) {
        if (nm != null) { nm.cancel(id); nm.cancel(id % FOLLOW_OFFSET + FOLLOW_OFFSET); }
        PendingIntent pi = follow(c, in, id, PendingIntent.FLAG_NO_CREATE);
        if (pi != null) {
            android.app.AlarmManager am = (android.app.AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(pi);
            pi.cancel();
        }
    }

    private static void show(Context c, NotificationManager nm, Intent in, int id) {
        if (nm == null) return;
        Alarms.ensureChannel(c);
        boolean isFollow = in.getBooleanExtra("follow", false);
        int nid = isFollow ? id % FOLLOW_OFFSET + FOLLOW_OFFSET : id;
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = new Notification.Builder(c, Alarms.CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_dose)
            .setColor(0xFF6457C9)
            .setContentTitle(in.getStringExtra("title"))
            .setContentText(in.getStringExtra("body"))
            .setCategory(Notification.CATEGORY_REMINDER)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setShowWhen(true)
            .setAutoCancel(true)
            .setContentIntent(openPi);
        if (!in.getBooleanExtra("plain", false)) {
            PendingIntent taken = PendingIntent.getBroadcast(c, id, copy(c, in, id, Alarms.ACT_TAKEN, "dosewell://taken/" + id), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            PendingIntent snooze = PendingIntent.getBroadcast(c, id, copy(c, in, id, Alarms.ACT_SNOOZE, "dosewell://snooze/" + id), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.addAction(new Notification.Action.Builder(null, c.getString(R.string.act_taken), taken).build());
            b.addAction(new Notification.Action.Builder(null, c.getString(R.string.act_snooze), snooze).build());
        }
        try { nm.notify(nid, b.build()); } catch (SecurityException ignored) { }
    }
}
