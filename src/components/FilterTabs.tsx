import { cn } from "@/lib/utils";

export type FilterKey = string; // "all" | "stock" | "promo" | <category-slug-or-name>

export type TypeKey = "all" | "DIGITAL" | "CLÉ" | "COMPTE" | "FORMATION";

export interface FilterDef {
  key: FilterKey;
  label: string;
  count: number;
}

export interface TypeDef {
  key: TypeKey;
  label: string;
  count: number;
}

interface FilterTabsProps {
  active: FilterKey;
  onChange: (k: FilterKey) => void;
  filters: FilterDef[];
  activeType?: TypeKey;
  onTypeChange?: (k: TypeKey) => void;
  types?: TypeDef[];
}

export const FilterTabs = ({
  active,
  onChange,
  filters,
  activeType,
  onTypeChange,
  types,
}: FilterTabsProps) => {
  return (
    <div className="border-b border-border bg-background">
      <div className="container mx-auto px-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-3">
          {filters.map((f) => {
            const isActive = active === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onChange(f.key)}
                className={cn(
                  "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all border",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-primary/15 hover:bg-primary/10 hover:text-foreground hover:border-primary/40"
                )}
              >
                {f.label}{" "}
                <span className={cn("ml-1 text-xs", isActive ? "opacity-90" : "opacity-60")}>
                  ({f.count})
                </span>
              </button>
            );
          })}
        </div>

        {types && types.length > 0 && onTypeChange && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 -mt-1">
            <span className="shrink-0 self-center text-[11px] uppercase tracking-widest text-muted-foreground mr-1">
              Par type
            </span>
            {types.map((t) => {
              const isActive = activeType === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => onTypeChange(t.key)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all border",
                    isActive
                      ? "bg-gold text-gold-foreground border-gold"
                      : "bg-transparent text-muted-foreground border-border hover:border-gold/40 hover:text-foreground"
                  )}
                >
                  {t.label}{" "}
                  <span className={cn("ml-1", isActive ? "opacity-90" : "opacity-60")}>
                    ({t.count})
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
