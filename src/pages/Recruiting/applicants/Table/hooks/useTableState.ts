// hooks/useTableState.ts
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { MRT_ColumnFiltersState, MRT_RowSelectionState } from 'material-react-table';

export function useTableState({
  showCompanyColumn,
  genderOptions,
  persistedState,
}: {
  onlyStatus?: string | string[];
  showCompanyColumn: boolean;
  jobPositionMap?: Record<string, any>;
  genderOptions: Array<{ id: string; title: string }>;
  persistedState?: any;
}): any {
  const location = useLocation();
  
  // Get navigation state once on mount (not in effect)
  const navState = (location.state as any);
  const isReturningFromDetails = navState?.returnToApplicants === true;
  
  // Initialize state SYNCHRONOUSLY based on priority
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
    // Priority 1: Navigation state (coming back from applicant details)
    if (isReturningFromDetails && navState?.columnFilters) {
      return navState.columnFilters;
    }
    
    // Priority 2: Persisted state
    if (persistedState?.columnFilters && Array.isArray(persistedState.columnFilters)) {
      return persistedState.columnFilters;
    }
    
    return [];
  });
  
  const [sorting, setSorting] = useState<Array<{ id: string; desc: boolean }>>(() => {
    if (isReturningFromDetails && navState?.sorting) return navState.sorting;
    if (persistedState?.sorting) return persistedState.sorting;
    return [{ id: 'submittedAt', desc: true }];
  });
  
  const [pagination, setPagination] = useState<{ pageIndex: number; pageSize: number }>(() => {
    if (isReturningFromDetails && navState?.pagination) return navState.pagination;
    if (persistedState?.pagination) return persistedState.pagination;
    return { pageIndex: 0, pageSize: 10 };
  });
  
  const [customFilters, setCustomFilters] = useState<Array<any>>(() => {
    if (isReturningFromDetails && navState?.customFilters) return navState.customFilters;
    if (persistedState?.customFilters) return persistedState.customFilters;
    return [];
  });
  
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});

 

  const selectedApplicantIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  
  const sanitizedColumnFilters = useMemo(() => {
    if (!Array.isArray(columnFilters)) return columnFilters;
    if (showCompanyColumn) return columnFilters;
    return columnFilters.filter((f: any) => f?.id !== 'companyId');
  }, [columnFilters, showCompanyColumn]);
  
  const initialColumnFilters = useMemo(() => sanitizedColumnFilters, [sanitizedColumnFilters]);
  
  // Sanitize gender filter
  useEffect(() => {
    try {
      const genderFilterIndex = columnFilters.findIndex((f: any) => f.id === 'gender');
      if (genderFilterIndex === -1) return;
      
      const current = columnFilters[genderFilterIndex];
      const vals = Array.isArray(current.value) ? current.value : current.value ? [current.value] : [];
      if (!vals.length) return;
      
      const optionIds = new Set(genderOptions.map((g) => g.id));
      const intersection = vals.filter((v: string) => optionIds.has(v));
      
      if (intersection.length === vals.length) return;
      
      const next = columnFilters.slice();
      if (intersection.length === 0) {
        next.splice(genderFilterIndex, 1);
      } else {
        next[genderFilterIndex] = { ...next[genderFilterIndex], value: intersection };
      }
      setColumnFilters(next);
    } catch (e) {}
  }, [genderOptions, columnFilters]);
  
  const persistTableState = useCallback(() => {
    try {
      const toSave = {
        pagination,
        sorting,
        columnFilters: sanitizedColumnFilters,
        customFilters,
      };
      sessionStorage.setItem('applicants_table_state', JSON.stringify(toSave));
      localStorage.setItem('applicants_table_state', JSON.stringify(toSave));
    } catch (e) {}
  }, [pagination, sorting, sanitizedColumnFilters, customFilters]);
  
  const clearPersistedState = useCallback(() => {
    try {
      localStorage.removeItem('applicants_table_state');
      sessionStorage.removeItem('applicants_table_state');
    } catch (e) {}
  }, []);
  
  const resetToDefault = useCallback(() => {
    setRowSelection({});
    setColumnFilters([]);
    setSorting([{ id: 'submittedAt', desc: true }]);
    setPagination({ pageIndex: 0, pageSize: 10 });
    setCustomFilters([]);
    clearPersistedState();
  }, [clearPersistedState]);
  
  useEffect(() => {
    const timer = setTimeout(() => persistTableState(), 100);
    return () => clearTimeout(timer);
  }, [persistTableState]);
  
  useEffect(() => {
    return () => {
      setTimeout(() => {
        const p = window.location.pathname || '';
        const inApplicantsPages = p.startsWith('/applicant-details') || p.startsWith('/applicants');
        if (!inApplicantsPages) {
          localStorage.removeItem('applicants_table_state');
          sessionStorage.removeItem('applicants_table_state');
        }
      }, 0);
    };
  }, []);
  
  return {
    rowSelection,
    setRowSelection,
    columnFilters,
    setColumnFilters,
    sorting,
    setSorting,
    pagination,
    setPagination,
    customFilters,
    setCustomFilters,
    initialColumnFilters,
    selectedApplicantIds,
    persistTableState,
    clearPersistedState,
    resetToDefault,
  };
}

export default useTableState;