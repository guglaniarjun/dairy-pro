import { useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";

/** Apply route context after options arrive; keep it reactive on same-page navigation. */
export function useCattleContext(form: any) {
  const search = useSearch();
  const cattleId = new URLSearchParams(search).get("cattleId") || "";
  const { data: animals } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  useEffect(() => {
    if (!cattleId || !animals) return;
    const animal = animals.find(
      (a) => a.id === cattleId && a.status === "active" && !a.mergedIntoId,
    );
    form.setValue("cattleId", animal ? cattleId : "");
    if (!animal)
      form.setError("cattleId", {
        message:
          "The linked animal is unavailable or inactive. Select an active animal.",
      });
    else form.clearErrors("cattleId");
  }, [cattleId, !!animals, form]);
  return cattleId;
}

export function cattleAction(path: string, cattleId?: string | null) {
  if (!cattleId || cattleId === "all") return path;
  return `${path}${path.includes("?") ? "&" : "?"}cattleId=${encodeURIComponent(cattleId)}`;
}
