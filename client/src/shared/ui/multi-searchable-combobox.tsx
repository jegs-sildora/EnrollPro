import * as React from "react";
import { ChevronsUpDown, Check, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";

export interface MultiSearchableComboboxItem {
  value: string;
  label: string;
}

interface MultiSearchableComboboxProps {
  items: readonly MultiSearchableComboboxItem[] | MultiSearchableComboboxItem[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  emptyText?: string;
}

export function MultiSearchableCombobox({
  items,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
  error = false,
  className,
  emptyText = "No results found",
}: MultiSearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const filtered = React.useMemo(() => {
    if (!debouncedSearch) return items;
    const q = debouncedSearch.toUpperCase();
    return items.filter(
      (i) =>
        i.label.toUpperCase().includes(q) || i.value.toUpperCase().includes(q)
    );
  }, [items, debouncedSearch]);

  const handleSelect = (item: MultiSearchableComboboxItem) => {
    if (value.includes(item.value)) {
      onChange(value.filter((v) => v !== item.value));
    } else {
      onChange([...value, item.value]);
    }
  };

  const handleRemove = (e: React.MouseEvent, itemValue: string) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(value.filter((v) => v !== itemValue));
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch("");
      setDebouncedSearch("");
    }
  };

  const selectedItems = items.filter((i) => value.includes(i.value));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex min-h-[44px] w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed transition-colors duration-200",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 items-center flex-1 pr-2">
            {selectedItems.length > 0 ? (
              selectedItems.map((item) => (
                <Badge
                  key={item.value}
                  variant="secondary"
                  className="font-bold text-xs uppercase px-2 py-0.5"
                >
                  {item.label}
                  <div
                    role="button"
                    tabIndex={0}
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-muted/50 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={(e) => handleRemove(e, item.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRemove(e as unknown as React.MouseEvent, item.value);
                      }
                    }}
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove {item.label}</span>
                  </div>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground uppercase font-bold truncate">
                {placeholder}
              </span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)]"
        align="start"
        sideOffset={4}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Search className="h-3.5 w-3.5 text-foreground shrink-0" />
          <Input
            autoComplete="off"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 shadow-none focus-visible:ring-2 p-0 text-base font-bold uppercase pl-2 ring-2 ring-primary"
            autoFocus
          />
        </div>

        <ul className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-base text-foreground text-center font-bold uppercase">
              {emptyText}
            </li>
          ) : (
            filtered.map((item) => (
              <li key={item.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-base font-bold uppercase text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                    value.includes(item.value) && "bg-accent text-accent-foreground"
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      value.includes(item.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
