"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Full IANA timezone list — computed once at module load
const TIMEZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["Europe/London", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"];
  }
})();

interface TimezoneComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TimezoneCombobox({
  value,
  onChange,
  disabled,
}: TimezoneComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!search.trim()) return TIMEZONES.slice(0, 100);
    const q = search.toLowerCase();
    return TIMEZONES.filter((tz) => tz.toLowerCase().includes(q)).slice(0, 100);
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-base md:text-sm",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{value || "Select timezone"}</span>
          <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search timezones..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((tz) => (
                <CommandItem
                  key={tz}
                  value={tz}
                  onSelect={(selected) => {
                    onChange(selected);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === tz ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {tz}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
