// components/ColumnMultiSelectHeader.tsx
import { useState } from 'react';
import { Menu, MenuItem, Checkbox, ListItemText } from '@mui/material';

export interface ColumnFilterOption {
  id: string;
  title: string;
}

export interface ColumnMultiSelectHeaderProps {
  column: any;
  label: string;
  options: ColumnFilterOption[];
  isLaptopViewport: boolean;
  menuWidth?: number;
  menuMaxHeight?: number;
  showSortIndicator?: boolean;
  onSortChange?: (column: any, direction: 'asc' | 'desc') => void;
}

export function ColumnMultiSelectHeader({
  column,
  label,
  options,
  isLaptopViewport,
  menuWidth = 220,
  menuMaxHeight = 280,
  showSortIndicator = true,
  onSortChange,
}: ColumnMultiSelectHeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Get current filter value with proper type checking
  const current = column.getFilterValue();
  const selected: string[] = Array.isArray(current)
    ? current.map(String)
    : current 
      ? [String(current)]
      : [];

  // Toggle a single option in the multi-select filter
  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    const arr = Array.from(next);
    column.setFilterValue(arr.length ? arr : undefined);
  };

  // Clear all selected filters
  const clear = () => {
    column.setFilterValue(undefined);
    setAnchorEl(null);
  };

  
  // Handle dropdown button click
  const handleDropdownClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation(); // Stop propagation to prevent row click
    setAnchorEl(event.currentTarget);
  };

  // Handle label click for sorting
  const handleLabelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop propagation
    
    if (column.getCanSort()) {
      const currentSort = column.getIsSorted();
      let newDirection: 'asc' | 'desc' | false;
      
      if (currentSort === false) {
        newDirection = 'desc'; // Default to desc on first click
      } else if (currentSort === 'desc') {
        newDirection = 'asc';
      } else {
        newDirection = false;
      }
      
      if (newDirection) {
        column.toggleSorting(newDirection === 'desc');
        onSortChange?.(column, newDirection);
      } else {
        column.clearSorting();
      }
    }
  };

  // Handle menu close
  const handleClose = () => setAnchorEl(null);

  // Prevent event propagation for menu interactions
  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Get the sort indicator character
  const getSortIndicator = () => {
    if (!showSortIndicator) return null;
    if (column.getIsSorted() === 'asc') return ' ▲';
    if (column.getIsSorted() === 'desc') return ' ▼';
    return null;
  };

  // Count of active filters
  const activeFilterCount = selected.length;
  
  // Check if all options are selected
  
  // Check if some options are selected (for indeterminate state)

  // Determine button padding based on viewport
  const buttonPadding = isLaptopViewport ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  return (
    <div
      onClick={(e) => e.stopPropagation()} // Stop propagation on the container
      onMouseDown={(e) => e.stopPropagation()}
      className="flex items-center gap-2"
    >
      {/* Label - clickable for sorting */}
      <span
        className={`text-sm font-medium cursor-pointer select-none hover:text-brand-500 ${
          column.getIsSorted() ? 'text-brand-600 dark:text-brand-400' : ''
        }`}
        onClick={handleLabelClick}
        title={column.getCanSort() ? `Sort by ${label}` : undefined}
      >
        {label}
        {getSortIndicator()}
      </span>

      {/* Filter dropdown button */}
      <button
        type="button"
        onClick={handleDropdownClick}
        className={`inline-flex items-center gap-1 rounded bg-gray-100 text-gray-700 transition-all hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 ${buttonPadding} ${
          activeFilterCount > 0 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : ''
        }`}
      >
        {activeFilterCount > 0 && (
          <span className="font-semibold">{activeFilterCount}</span>
        )}
        <svg 
          className="h-3 w-3" 
          viewBox="0 0 20 20" 
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        onClick={handleMenuClick}
        PaperProps={{
          style: { maxHeight: menuMaxHeight, width: menuWidth },
          onMouseDown: (e: any) => e.stopPropagation(),
          onClick: (e: any) => e.stopPropagation(),
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
      
        
        {/* Divider between Select All and options */}
        {options.length > 1 && <hr className="my-1 border-gray-200 dark:border-gray-700" />}
        
        {/* Clear option */}
        <MenuItem 
          onClick={(e) => { 
            e.stopPropagation(); 
            clear(); 
          }} 
          dense
          sx={{ color: 'error.main' }}
        >
          <ListItemText primary="Clear" primaryTypographyProps={{ sx: { color: 'error.main' } }} />
        </MenuItem>
        
        {/* Divider after Clear */}
        <hr className="my-1 border-gray-200 dark:border-gray-700" />
        
        {/* Filter options */}
        {options.map((option) => (
          <MenuItem
            key={option.id}
            dense
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(option.id);
            }}
          >
            <Checkbox 
              checked={selected.includes(option.id)} 
              size="small" 
            />
            <ListItemText 
              primary={option.title}
              primaryTypographyProps={{
                style: {
                  fontSize: '0.875rem',
                },
              }}
            />
          </MenuItem>
        ))}
        
        {/* Empty state */}
        {options.length === 0 && (
          <MenuItem disabled dense>
            <ListItemText primary="No options available" />
          </MenuItem>
        )}
      </Menu>
    </div>
  );
}

// Optional: Simplified version for single-select filters
export interface ColumnSingleSelectHeaderProps {
  column: any;
  label: string;
  options: ColumnFilterOption[];
  isLaptopViewport: boolean;
  menuWidth?: number;
  menuMaxHeight?: number;
}

export function ColumnSingleSelectHeader({
  column,
  label,
  options,
  isLaptopViewport,
  menuWidth = 220,
  menuMaxHeight = 280,
}: ColumnSingleSelectHeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  const current = column.getFilterValue();
  const selected = current ? String(current) : '';

  const select = (value: string) => {
    column.setFilterValue(value === selected ? undefined : value);
    setAnchorEl(null);
  };

  const clear = () => {
    column.setFilterValue(undefined);
    setAnchorEl(null);
  };

  const handleDropdownClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleLabelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (column.getCanSort()) {
      column.toggleSorting();
    }
  };

  const handleClose = () => setAnchorEl(null);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const getSortIndicator = () => {
    if (column.getIsSorted() === 'asc') return ' ▲';
    if (column.getIsSorted() === 'desc') return ' ▼';
    return null;
  };

  // Get the label of the selected option
  const selectedLabel = options.find(opt => opt.id === selected)?.title || '';

  // Determine button padding based on viewport
  const buttonPadding = isLaptopViewport ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="flex items-center gap-2"
    >
      <span
        className={`text-sm font-medium cursor-pointer select-none hover:text-brand-500 ${
          column.getIsSorted() ? 'text-brand-600 dark:text-brand-400' : ''
        }`}
        onClick={handleLabelClick}
      >
        {label}
        {getSortIndicator()}
      </span>

      <button
        type="button"
        onClick={handleDropdownClick}
        className={`inline-flex items-center gap-1 rounded bg-gray-100 text-gray-700 transition-all hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 ${buttonPadding} ${
          selected ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : ''
        }`}
      >
        {selected && (
          <span className="max-w-[60px] truncate font-semibold">
            {selectedLabel}
          </span>
        )}
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none">
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        onClick={handleMenuClick}
        PaperProps={{
          style: { maxHeight: menuMaxHeight, width: menuWidth },
          onMouseDown: (e: any) => e.stopPropagation(),
          onClick: (e: any) => e.stopPropagation(),
        }}
      >
        <MenuItem onClick={(e) => { e.stopPropagation(); clear(); }} dense>
          <ListItemText primary="Clear" />
        </MenuItem>
        <hr className="my-1 border-gray-200 dark:border-gray-700" />
        {options.map((option) => (
          <MenuItem
            key={option.id}
            dense
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              select(option.id);
            }}
          >
            <Checkbox 
              checked={selected === option.id} 
              size="small" 
            />
            <ListItemText primary={option.title} />
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}

// Optional: Compact header for mobile/responsive views
export interface ColumnCompactHeaderProps {
  column: any;
  label: string;
  options: ColumnFilterOption[]; // Kept for consistency but not used
  isLaptopViewport?: boolean; // Made optional since not used
}

export function ColumnCompactHeader({
  column,
  label,
}: ColumnCompactHeaderProps) {
  const current = column.getFilterValue();
  const selected: string[] = Array.isArray(current)
    ? current.map(String)
    : current 
      ? [String(current)]
      : [];

  const activeCount = selected.length;

  const handleLabelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (column.getCanSort()) {
      column.toggleSorting();
    }
  };

  const getSortIndicator = () => {
    if (column.getIsSorted() === 'asc') return ' ↑';
    if (column.getIsSorted() === 'desc') return ' ↓';
    return null;
  };

  return (
    <div className="flex items-center gap-1">
      <span
        className={`text-xs font-medium cursor-pointer select-none ${
          column.getIsSorted() ? 'text-brand-600 dark:text-brand-400' : ''
        }`}
        onClick={handleLabelClick}
      >
        {label}
        {getSortIndicator()}
      </span>
      {activeCount > 0 && (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white">
          {activeCount}
        </span>
      )}
    </div>
  );
}

export default ColumnMultiSelectHeader;