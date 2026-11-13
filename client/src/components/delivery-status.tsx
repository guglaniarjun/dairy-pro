import { useQuery } from "@tanstack/react-query";
import { Panel, EntryForm } from "./farm-forms";
import { apiRequest, queryClient } from "@/lib/queryClient";
export function DeliveryStatus() {
  const query = useQuery<any[]>({
    queryKey: ["/api/operations/delivery-status"],
  });
  return (
    <Panel
      title="Notification delivery"
      description="Review failed or interrupted WhatsApp deliveries. Farm alerts remain available in Alerts and daily reports."
    >
      {query.error && (
        <p role="alert">
          Delivery history could not be loaded. Connect to the server to review
          it.
        </p>
      )}
      {query.data?.length === 0 && <p>No delivery history yet.</p>}
      {(query.data || []).map((log) => (
        <details key={log.id} className="border rounded p-3">
          <summary>
            {new Date(log.createdAt).toLocaleString()} · {log.status} ·{" "}
            {log.recipientPhone || log.phone || "Configured recipient"}
          </summary>
          <p className="text-sm whitespace-pre-wrap">{log.message}</p>
          <p className="text-sm text-destructive">{log.errorMessage}</p>
          {["review_required", "failed_permanent"].includes(log.status) && (
            <EntryForm
              label="Retry verified undelivered message"
              onSave={async () => {
                const r = await apiRequest(
                  "POST",
                  `/api/operations/delivery-status/${log.id}/retry`,
                  { verifiedNotDelivered: true },
                );
                await queryClient.invalidateQueries({
                  queryKey: ["/api/operations/delivery-status"],
                });
                return r.json();
              }}
            >
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" required />I checked delivery history and
                the recipient conversation. This message was not delivered.
              </label>
            </EntryForm>
          )}
        </details>
      ))}
    </Panel>
  );
}
