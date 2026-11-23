import { Card } from "@/components/ui/card";
import { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface KpiCardProps {
  title: string;
  value: ReactNode;
  variation?: { value: string; positive: boolean };
  icon: ReactNode;
  spark?: { v: number }[];
}

export function KpiCard({ title, value, variation, icon, spark = [] }: KpiCardProps) {
  return (
    <Card className="bg-card border-border p-3 sm:p-4 relative overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{title}</p>
          <p className="text-lg sm:text-2xl font-bold mt-1 break-words">
            {value}
          </p>
          {variation && (
            <div
              className={`mt-1 inline-flex items-center gap-1 text-[10px] sm:text-xs ${
                variation.positive ? "text-success" : "text-destructive"
              }`}
            >
              {variation.positive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
              <span className="truncate">{variation.value}</span>
            </div>
          )}
        </div>
        <div className="text-xl sm:text-2xl shrink-0">{icon}</div>
      </div>
      {spark.length > 0 && (
        <div className="h-10 mt-2 -mx-4 -mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark}>
              <defs>
                <linearGradient id={`g-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} fill={`url(#g-${title})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
