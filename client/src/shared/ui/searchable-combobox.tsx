import * as React from "react";
import { ChevronsUpDown, Check, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

export interface SearchableComboboxItem {
  value: string;
  label: string;
}

interface SearchableComboboxProps {
  items: readonly SearchableComboboxItem[] | SearchableComboboxItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  emptyText?: string;
}

export function SearchableCombobox({
  items,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
  error = false,
  className,
  emptyText = "No results found",
}: SearchableComboboxProps) {
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

  const selectedItem = items.find((i) => i.value === value);

  function handleSelect(item: SearchableComboboxItem) {
    onChange(item.value);
    setOpen(false);
    setSearch("");
    setDebouncedSearch("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSearch("");
      setDebouncedSearch("");
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex min-h-[44px] w-full items-center justify-between rounded-md border border-input bg-background px-4 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed font-extrabold transition-colors duration-200",
            !value && "text-foreground",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
        >
          <span className="truncate uppercase">
            {selectedItem ? selectedItem.label : value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
            className="h-8 border-0 shadow-none focus-visible:ring-2 p-0 text-base font-extrabold uppercase pl-2 ring-2 ring-primary"
            autoFocus
          />
        </div>

        <ul className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-base text-foreground text-center">
              {emptyText}
            </li>
          ) : (
            filtered.map((item) => (
              <li key={item.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-base font-extrabold text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                    item.value === value && "bg-accent text-accent-foreground"
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      item.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item.label.toUpperCase()}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
