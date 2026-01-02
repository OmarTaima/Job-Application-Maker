import React, { useState, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  defaultValue?: string;
  value?: string;
}

const Select: React.FC<SelectProps> = ({
  options,
  placeholder = "Select an option",
  onChange,
  className = "",
  defaultValue = "",
  value,
}) => {
  // Manage the selected value
  const [selectedValue, setSelectedValue] = useState<string>(defaultValue);

  // If a controlled `value` prop is provided, sync internal state
  useEffect(() => {
    if (typeof value === "string") {
      setSelectedValue(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedValue(value);
    onChange(value); // Trigger parent handler
  };
  let content: React.ReactNode = null;
  try {
    console.debug("Select render", {
      options,
      placeholder,
      selectedValue,
      className,
    });
    content = (
      <select
        className={`h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 ${
          selectedValue
            ? "text-gray-800 dark:text-white/90"
            : "text-gray-400 dark:text-gray-400"
        } ${className}`}
        value={selectedValue}
        onChange={handleChange}
      >
        {/* Placeholder option */}
        <option
          value=""
          disabled
          className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
        >
          {placeholder}
        </option>
        {/* Map over options */}
        {Array.isArray(options) &&
          options.map((option) => {
            // support option as string or object
            const optValue =
              typeof option === "string" ? option : option?.value;
            const optLabel =
              typeof option === "string" ? option : option?.label ?? optValue;
            return (
              <option
                key={String(optValue ?? optLabel)}
                value={optValue}
                className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
              >
                {optLabel}
              </option>
            );
          })}
      </select>
    );
  } catch (err) {
    console.error("Select render error:", err, { options, selectedValue });
    content = (
      <select
        className={`h-11 w-full ${className}`}
        value={selectedValue}
        onChange={handleChange}
      >
        <option value="">{placeholder}</option>
      </select>
    );
  }

  return <>{content}</>;
};

export default Select;
