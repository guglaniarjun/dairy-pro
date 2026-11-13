package in.dairyflow.farm;

import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(manifest=Config.NONE,sdk=28)
public class FarmStoreTest {
    @Test public void pendingEntrySurvivesDatabaseReopen() throws Exception {
        String key="outbox:user-a:farm-a:stable-id";
        String json="{\"id\":\"stable-id\",\"cattleId\":\"cow-1\",\"quantity\":0}";
        try(FarmStore db=new FarmStore(RuntimeEnvironment.getApplication())){db.put(key,json);}
        try(FarmStore db=new FarmStore(RuntimeEnvironment.getApplication())){assertEquals(json,db.get(key));db.remove(key);}
    }
    @Test public void cachedViewsAndOutboxesAreSeparatedByFarm() throws Exception {
        try(FarmStore db=new FarmStore(RuntimeEnvironment.getApplication())){
            db.put("outbox:u:a:one","a");db.put("outbox:u:b:two","b");
            assertEquals(1,db.list("outbox:u:a:").length());
            db.remove("outbox:u:a:one");assertEquals("b",db.get("outbox:u:b:two"));db.remove("outbox:u:b:two");
        }
    }
    @Test public void overwritingAQueuedEntryDoesNotDuplicateIt() throws Exception {
        try(FarmStore db=new FarmStore(RuntimeEnvironment.getApplication())){
            db.put("outbox:u:c:entry","before");db.put("outbox:u:c:entry","reviewed");
            assertEquals(1,db.list("outbox:u:c:").length());assertEquals("reviewed",db.get("outbox:u:c:entry"));db.remove("outbox:u:c:entry");
        }
    }
    @Test public void farmNamesAreStoredAsDataAndPreserveUnicode() throws Exception {
        try(FarmStore db=new FarmStore(RuntimeEnvironment.getApplication())){
            String key="cache:नाम:'; DROP TABLE kv;--";
            db.put(key,"गाय १२ — दूध 0.0");assertEquals("गाय १२ — दूध 0.0",db.get(key));db.put("check","ok");assertEquals("ok",db.get("check"));db.remove(key);db.remove("check");
        }
    }
}
