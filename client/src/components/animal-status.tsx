import { inStage } from "@shared/care";
import { Badge } from "@/components/ui/badge";

export function AnimalStatus({ animal }: { animal: any }) {
  const states = ["milking", "dry", "pregnant", "heifer", "calf"].filter(
    (stage) => inStage(animal, stage),
  );
  return (
    <span className="flex flex-wrap gap-1">
      {(states.length ? states : [animal.lifeStage || animal.stage]).map(
        (stage) => (
          <Badge
            key={stage}
            variant="secondary"
            className={
              stage === "pregnant"
                ? "capitalize bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200"
                : "capitalize"
            }
          >
            {stage}
          </Badge>
        ),
      )}
    </span>
  );
}
