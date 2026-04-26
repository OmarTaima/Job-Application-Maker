// components/StatusCell.tsx
import { useMemo } from 'react';
import { useStatusSettings } from '../../../../../utils/useStatusSettings';

interface StatusCellProps {
  status: string;
  applicant?: any;
  companyId?: string | null;
  allCompanies?: any[];
  selectedCompanyFilter?: string[] | null;
  showTooltip?: boolean;
  className?: string;
  onClick?: (status: string, applicant: any) => void;
}

export function StatusCell({
  status,
  applicant,
  companyId,
  allCompanies = [],
  selectedCompanyFilter,
  showTooltip = true,
  className = '',
  onClick,
}: StatusCellProps) {
  // Determine which company to use for status settings
  const effectiveCompany = useMemo(() => {
    
    
    // Priority 1: If a single company is selected in the filter (for Super Admin)
    if (selectedCompanyFilter && selectedCompanyFilter.length === 1) {
      const found = allCompanies.find((c: any) => c._id === selectedCompanyFilter[0]);
      if (found) {
        
        return found;
      }
    }
    
    // Priority 2: Use provided companyId
    if (companyId) {
      const found = allCompanies.find((c: any) => c._id === companyId);
      if (found) {
        
        return found;
      }
    }
    
    // Priority 3: Try to extract company from applicant
    if (applicant) {
      const rawCompany = applicant?.companyId || applicant?.company || applicant?.companyObj;
      if (rawCompany) {
        const companyIdValue = typeof rawCompany === 'string' 
          ? rawCompany 
          : rawCompany?._id || rawCompany?.id;
        if (companyIdValue) {
          const found = allCompanies.find((c: any) => c._id === companyIdValue);
          if (found) {
            return found;
          }
        }
      }
    }
    
    return null;
  }, [selectedCompanyFilter, companyId, applicant, allCompanies]);

  // Get status settings for the effective company
  const { getColor, getTextColor, getDescription, statusOptions } = useStatusSettings(effectiveCompany);

  // Get status colors
  const colors = useMemo(() => {
    if (!status) {
      return { bg: '#F3F4F6', color: '#1F2937' };
    }

    // Try to get colors from company settings
    const bgColor = getColor(status);
    const textColor = getTextColor(status);
    
    
    
    // If we got valid colors from company settings, use them
    if (bgColor && textColor) {
      return { bg: bgColor, color: textColor };
    }
    
    // Fallback - try to find the status in statusOptions
    const statusOption = statusOptions.find(opt => opt.value === status);
    if (statusOption && statusOption.color) {
      return { bg: statusOption.color, color: statusOption.textColor || '#FFFFFF' };
    }
    
    // Ultimate fallback
    return { bg: '#F3F4F6', color: '#1F2937' };
  }, [status, getColor, getTextColor, statusOptions]);

  // Get status description/tooltip text
  const tooltip = useMemo(() => {
    const description = getDescription(status);
    return description || `Status: ${status}`;
  }, [status, getDescription]);

  // Format status label for display
  const label = useMemo(() => {
    if (!status) return '-';
    // Try to get custom label from statusOptions
    const statusOption = statusOptions.find(opt => opt.value === status);
    if (statusOption && statusOption.label && statusOption.label !== status) {
      return statusOption.label;
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  }, [status, statusOptions]);

  const handleClick = () => {
    if (onClick) {
      onClick(status, applicant);
    }
  };

  return (
    <span
      onClick={handleClick}
      title={showTooltip ? tooltip : undefined}
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 hover:opacity-80 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.color,
      }}
    >
      <span>{label}</span>
    </span>
  );
}

export default StatusCell;