package in.dairyflow.farm;

import android.content.Context;
import org.json.*;
import org.junit.*;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import okhttp3.mockwebserver.*;

@RunWith(RobolectricTestRunner.class)
@Config(manifest=Config.NONE,sdk=28)
public class FarmSyncTest {
    Context context; MockWebServer server;
    @Before public void setup() throws Exception {
        context=RuntimeEnvironment.getApplication(); server=new MockWebServer();server.start();
        context.getSharedPreferences("farm",0).edit().putString("server",server.url("/").toString().replaceAll("/$", "")).commit();
        try(FarmStore db=new FarmStore(context)){db.put("session","{\"id\":\"u\",\"tenantId\":\"f\"}");}
    }
    @After public void teardown() throws Exception {server.shutdown();}
    void response(int status,String body){server.enqueue(new MockResponse().setResponseCode(status).setHeader("Content-Type","application/json").setBody(body));}
    void auth(){response(200,"{\"id\":\"u\",\"tenantId\":\"f\"}");}
    void queue(String id,String path,String method,JSONObject data) throws Exception {
        try(FarmStore db=new FarmStore(context)){db.put("outbox:u:f:"+id,new JSONObject().put("id",id).put("scope","u:f").put("tenantId","f").put("path",path).put("method",method).put("data",data).put("createdAt",id).toString());}
    }
    @Test public void dependenciesResolveAndEmptyPatchReceiptsAreDurable() throws Exception {
        queue("1","/api/cattle","POST",new JSONObject().put("tagNumber","A"));
        queue("2","/api/cattle/pending:1","PATCH",new JSONObject().put("revision",1));
        auth();response(201,"{\"id\":\"cow\"}");response(204,"");
        assertEquals(2,FarmNetwork.sync(context,false).getInt("synced"));
        server.takeRequest();RecordedRequest create=server.takeRequest(),patch=server.takeRequest();
        assertEquals("1",create.getHeader("Idempotency-Key"));assertEquals("PATCH",patch.getMethod());assertEquals("/api/cattle/cow",patch.getPath());
        try(FarmStore db=new FarmStore(context)){assertEquals(0,db.list("outbox:u:f:").length());assertNotNull(db.get("result:u:f:2"));}
    }
    @Test public void conflictsRemainWhileIndependentWorkSyncs() throws Exception {
        queue("1","/api/tasks/t","PATCH",new JSONObject().put("revision",1));queue("2","/api/milk","POST",new JSONObject().put("quantity",0));
        auth();response(409,"{\"error\":\"Review revision\"}");response(201,"{\"id\":\"milk\"}");
        assertEquals(1,FarmNetwork.sync(context,false).getInt("conflicts"));
        try(FarmStore db=new FarmStore(context)){assertTrue(new JSONObject(db.get("outbox:u:f:1")).getBoolean("rejected"));assertNull(db.get("outbox:u:f:2"));}
        auth();assertEquals(1,FarmNetwork.sync(context,false).getInt("conflicts"));assertEquals(4,server.getRequestCount());
    }
    @Test public void anotherFarmCannotReceivePendingEntries() throws Exception {
        queue("1","/api/milk","POST",new JSONObject());response(200,"{\"id\":\"u\",\"tenantId\":\"other\"}");
        try{FarmNetwork.sync(context,false);fail("Must preserve queue");}catch(java.io.IOException expected){assertTrue(expected.getMessage().contains("farm changed"));}
        assertEquals(1,server.getRequestCount());try(FarmStore db=new FarmStore(context)){assertNotNull(db.get("outbox:u:f:1"));}
    }
    @Test public void serverFailureRetriesWithTheSameKey() throws Exception {
        queue("1","/api/milk","POST",new JSONObject());auth();response(503,"Unavailable");
        try{FarmNetwork.sync(context,false);fail("Must retain entry");}catch(java.io.IOException expected){}
        auth();response(200,"{\"id\":\"milk\"}");assertEquals(1,FarmNetwork.sync(context,false).getInt("synced"));
        server.takeRequest();String first=server.takeRequest().getHeader("Idempotency-Key");server.takeRequest();assertEquals(first,server.takeRequest().getHeader("Idempotency-Key"));
    }
}
