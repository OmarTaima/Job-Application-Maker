import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TableLayout } from '../../services/authService';
import axiosInstance from '../../config/axios';

const EMPTY_LAYOUT: TableLayout = {
  columnVisibility: {},
  columnSizing: {},
  columnOrder: [],
};

export const useTableLayout = (
  tableKey: string,
  defaultLayout: TableLayout = EMPTY_LAYOUT
) => {
  const { user } = useAuth();
  const [layout, setLayout] = useState<TableLayout>(defaultLayout);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLayout = useRef<TableLayout | null>(null);

  // Load from user (already fetched from backend on login)
  useEffect(() => {
    if (!user?._id) return;
    try {
      const saved = user.tablePreferences?.[tableKey];
      if (saved) {
        setLayout({ ...defaultLayout, ...saved });
      } else {
        setLayout(defaultLayout);
      }
    } catch (e) {
      console.error('Failed to load table layout', e);
    } finally {
      setIsLoaded(true);
    }
  }, [user?._id, tableKey]);

  // Cleanup timeout on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  const saveLayout = useCallback(
    (updates: Partial<TableLayout>) => {
      if (!user?._id) return;

      // Update state immediately for responsive UI
      setLayout((prev) => {
        const next = { ...prev, ...updates };
        pendingLayout.current = next;
        return next;
      });

      // Debounce the API call using the ref, not the state value
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        if (!pendingLayout.current) return;
        axiosInstance
          .patch(`/users/preferences/${tableKey}`, pendingLayout.current)
          .catch((e) => console.error('Failed to save layout', e));
      }, 2000);
    },
    [user?._id, tableKey]
  );

  return { layout, saveLayout, isLoaded };
};
