import * as React from "react";
import { ChevronsUpDown, Check, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

export interface AddressComboboxItem {
  code: string;
  name: string;
}

interface AddressComboboxProps {
  items: AddressComboboxItem[];
  value: string; // the selected name (empty string = nothing selected)
  onChange: (name: string, code: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export function AddressCombobox({
  items,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled = false,
  error = false,
  className,
}: AddressComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  // 200 ms debounce on search input
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const filtered = React.useMemo(() => {
    if (!debouncedSearch) return items;
    const q = debouncedSearch.toUpperCase();
    return items.filter((i) => i.name.toUpperCase().includes(q));
  }, [items, debouncedSearch]);

  function handleSelect(item: AddressComboboxItem) {
    onChange(item.name.toUpperCase(), item.code);
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
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-11 font-bold text-left",
            !value && "text-muted-foreground font-normal",
            error && "border-destructive focus-visible:ring-destructive",
            className,
          )}
        >
          <span className="truncate uppercase">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)] max-w-sm"
        align="start"
        sideOffset={4}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 shadow-none focus-visible:ring-0 p-0 text-sm font-normal"
            autoFocus
          />
        </div>

        {/* List */}
        <ul className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground text-center">
              No results found
            </li>
          ) : (
            filtered.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                    item.name === value && "bg-accent text-accent-foreground",
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      item.name === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {item.name.toUpperCase()}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
