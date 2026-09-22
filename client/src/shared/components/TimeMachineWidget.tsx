import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { Clock } from "lucide-react";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";

export function TimeMachineWidget() {
  if (!import.meta.env.DEV) {
    return null;
  }

  const [mockDate, setMockDate] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("mocked_system_date");
    if (saved) {
      setMockDate(saved);
    }
  }, []);

  const handleDateChange = (val: string) => {
    setMockDate(val);
    if (val) {
      localStorage.setItem("mocked_system_date", val);
    } else {
      localStorage.removeItem("mocked_system_date");
    }
    // Force reload to apply new date across all app state
    window.location.reload();
  };

  const resetToRealTime = () => {
    setMockDate("");
    localStorage.removeItem("mocked_system_date");
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999]">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className="h-12 w-12 rounded-full shadow-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center p-0"
            title="Time Machine (Dev Only)"
          >
            <Clock className="h-6 w-6" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4 bg-background shadow-xl rounded-xl border-orange-500/50" side="top" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-extrabold text-orange-500 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Machine
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Override the system date for testing term rollover. This only affects your local browser session.
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-foreground">Mocked Date</label>
              <HybridDatePicker
                value={mockDate}
                onChange={handleDateChange}
                placeholder="YYYY-MM-DD"
                className="w-full border rounded-md"
              />
            </div>

            <Button
              variant="outline"
              className="w-full font-bold"
              onClick={resetToRealTime}
              disabled={!mockDate}
            >
              Reset to Real Time
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
