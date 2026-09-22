import { AlertTriangle } from "lucide-react";
import { DISCLAIMER } from "@/lib/health-utils";

export function Disclaimer() {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
      <p>{DISCLAIMER}</p>
    </div>
  );
}
