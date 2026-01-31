import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";

import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  defaultDate?: DateOption;
  label?: string;
  placeholder?: string;
};

export default function DatePicker({
  id,
  mode = "single",
  onChange,
  label,
  defaultDate,
  placeholder,
}: PropsType) {
  const isAutoSetting = useRef(false);

  useEffect(() => {
    const isRange = mode === "range";

    // Normalize today (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const handleChange: Hook = (selectedDates, dateStr, instance) => {
      // Prevent loop
      if (isAutoSetting.current) {
        isAutoSetting.current = false;
        return;
      }

      // Auto set end date to today in range mode
      if (isRange && selectedDates.length === 1) {
        isAutoSetting.current = true;
        instance.setDate([selectedDates[0], today], true);
        return;
      }

      if (onChange) {
        if (Array.isArray(onChange)) {
          onChange.forEach((fn) => fn(selectedDates, dateStr, instance));
        } else {
          onChange(selectedDates, dateStr, instance);
        }
      }
    };

    const fp = flatpickr(`#${id}`, {
      mode: mode === "time" ? "single" : mode,
      enableTime: mode === "time",
      noCalendar: mode === "time",
      dateFormat: mode === "time" ? "h:i K" : "Y-m-d",
      time_24hr: false,
      defaultDate,
      monthSelectorType: "static",
      static: true,
      closeOnSelect: !isRange,
      onValueUpdate: handleChange,
    });

    // Enhance calendar UI
    try {
      const instance = Array.isArray(fp) ? fp[0] : fp;
      const cal = instance?.calendarContainer;
      if (cal) {
        // use a more compact default width and keep responsive cap
        cal.style.width = "720px";
        cal.style.maxWidth = "90vw";
        cal.style.left = "50%";
        cal.style.transform = "translateX(-50%)";
        cal.style.zIndex = "50";
        try { cal.style.minWidth = '360px'; } catch {}
      }
    } catch {}

    return () => {
      if (Array.isArray(fp)) {
        fp.forEach((f) => f.destroy());
      } else {
        fp.destroy();
      }
    };
  }, [id, mode, onChange, defaultDate]);

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          id={id}
          readOnly
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border px-4 py-2.5 text-sm cursor-pointer
            bg-transparent text-gray-800 border-gray-300
            focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20
            dark:bg-gray-900 dark:text-white/90 dark:border-gray-700"
        />

        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  );
}
