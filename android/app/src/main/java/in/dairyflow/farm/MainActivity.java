package in.dairyflow.farm;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override protected void onNewIntent(android.content.Intent intent){super.onNewIntent(intent);setIntent(intent);}
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(FarmSyncPlugin.class);
        super.onCreate(savedInstanceState);
        FarmSyncWorker.schedule(this);
        FarmReminderWorker.schedule(this);
        if(android.os.Build.VERSION.SDK_INT>=33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},1);
    }
}
