// components/ApplicantsTable.tsx
import { useMemo, useEffect, useState } from 'react';
import {
  MaterialReactTable,
  MRT_SelectCheckbox,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_RowSelectionState,
  type MRT_ColumnFiltersState,
} from 'material-react-table';
import { ThemeProvider, createTheme } from '@mui/material';

interface ApplicantsTableProps {
  // Data
  data: any[];
  isLoading: boolean;
  
  // Column configurations
  columns: MRT_ColumnDef<any>[];
  
  // State
  sorting: Array<{ id: string; desc: boolean }>;
  setSorting: React.Dispatch<React.SetStateAction<Array<{ id: string; desc: boolean }>>>;
  pagination: { pageIndex: number; pageSize: number };
  setPagination: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>;
  columnFilters: MRT_ColumnFiltersState;
  setColumnFilters: React.Dispatch<React.SetStateAction<MRT_ColumnFiltersState>>;
  rowSelection: MRT_RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<MRT_RowSelectionState>>;
  
  // Layout
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  onColumnVisibilityChange: (updater: any) => void;
  onColumnSizingChange: (updater: any) => void;
  onColumnOrderChange: (updater: any) => void;
  
  // Options
  selectColumnWidth: number;
  tableMinWidth: number;
  isLaptopViewport: boolean;
  duplicatesOnlyEnabled?: boolean;
  
  // Custom renderers
  renderTopToolbarCustomActions?: () => React.ReactNode;
}

export function ApplicantsTable({
  data,
  isLoading,
  columns,
  sorting,
  setSorting,
  pagination,
  setPagination,
  columnFilters,
  setColumnFilters,
  rowSelection,
  setRowSelection,
  columnVisibility,
  columnOrder,
  onColumnVisibilityChange,
  onColumnSizingChange,
  onColumnOrderChange,
  selectColumnWidth,
  tableMinWidth,
  isLaptopViewport,
  duplicatesOnlyEnabled = false,
  renderTopToolbarCustomActions,
}: ApplicantsTableProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const darkMode = document.documentElement.classList.contains('dark');
      setIsDarkMode(darkMode);
    };

    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Create skeleton data for loading state
  const skeletonData = useMemo(
    () =>
      Array.from({ length: pagination.pageSize || 10 }).map(
        (_: any, i: number) => ({ _id: `skeleton-${i}`, _skeleton: true })
      ),
    [pagination.pageSize]
  );

  const tableData = isLoading ? skeletonData : data;

  // MUI Theme for the table
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDarkMode ? 'dark' : 'light',
          primary: {
            main: '#e42e2b',
          },
          background: {
            default: isDarkMode ? '#24303F' : '#FFFFFF',
            paper: isDarkMode ? '#24303F' : '#FFFFFF',
          },
          text: {
            primary: isDarkMode ? '#E4E7EC' : '#101828',
            secondary: isDarkMode ? '#98A2B3' : '#667085',
          },
          divider: isDarkMode ? '#344054' : '#E4E7EC',
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
                backgroundImage: 'none',
              },
            },
          },
          MuiTable: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
              },
            },
          },
          MuiTableContainer: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
              },
            },
          },
          MuiTableBody: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
              },
            },
          },
          MuiTableHead: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB',
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderColor: isDarkMode ? '#344054' : '#E4E7EC',
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
                color: isDarkMode ? '#E4E7EC' : '#101828',
              },
              head: {
                backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB',
                color: isDarkMode ? '#E4E7EC' : '#344054',
                fontWeight: 600,
              },
            },
          },
          MuiTableRow: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
                '&:hover': {
                  backgroundColor: isDarkMode ? '#344054' : '#F9FAFB',
                },
              },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: {
                color: isDarkMode ? '#98A2B3' : '#667085',
              },
            },
          },
          MuiCheckbox: {
            defaultProps: {
              size: 'large',
            },
            styleOverrides: {
              root: {
                color: isDarkMode ? '#667085' : '#98A2B3',
                padding: '2px',
                '& .MuiSvgIcon-root': {
                  fontSize: '2rem',
                },
                '&.Mui-checked': {
                  color: '#e42e2b',
                },
              },
            },
          },
          MuiToolbar: {
            styleOverrides: {
              root: {
                backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
                color: isDarkMode ? '#E4E7EC' : '#101828',
              },
            },
          },
        },
      }),
    [isDarkMode]
  );

  // Create the table instance
  const table = useMaterialReactTable({
    columns,
    enableSorting: !duplicatesOnlyEnabled,
    data: tableData,
    displayColumnDefOptions: {
      'mrt-row-select': {
        size: selectColumnWidth,
        muiTableHeadCellProps: {
          align: 'center',
          sx: {
            padding: 0,
            width: `${selectColumnWidth}px`,
            minWidth: `${selectColumnWidth}px`,
            maxWidth: `${selectColumnWidth}px`,
          },
        },
        muiTableBodyCellProps: {
          align: 'center',
          sx: {
            padding: 0,
            width: `${selectColumnWidth}px`,
            minWidth: `${selectColumnWidth}px`,
            maxWidth: `${selectColumnWidth}px`,
          },
        },
        Cell: ({ row, table }: any) => {
          if (isLoading) return null;
          return (
            <div
              className="flex items-center justify-center p-2"
              onClick={(e) => e.stopPropagation()}
              onAuxClick={(e) => e.stopPropagation()}
            >
              <MRT_SelectCheckbox row={row} table={table} />
            </div>
          );
        },
      },
    },
    enableRowSelection: !isLoading,
    enablePagination: true,
    enableBatchRowSelection: false,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    enableColumnFilters: true,
    enableFilters: true,
    enableHiding: true,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableColumnActions: false,
    enableColumnResizing: true,
    layoutMode: 'grid',
    manualPagination: false,
    manualFiltering: false,
    manualSorting: false,
    rowCount: isLoading ? skeletonData.length : data.length,
    initialState: {
      pagination,
      columnFilters,
      columnVisibility,
      density: 'compact',
      columnOrder: columnOrder.length
        ? columnOrder
        : Array.from(
            new Set(
              ['mrt-row-select', ...columns.map((c) => (c as any).id ?? (c as any).accessorKey).filter(Boolean)]
            )
          ),
    },
    state: {
      sorting,
      pagination,
      columnFilters,
      rowSelection,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange,
    onColumnSizingChange,
    onColumnOrderChange,
    muiTablePaperProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        backgroundImage: 'none',
      },
    },
    muiTableProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        tableLayout: 'auto',
        width: '100%',
        minWidth: `${tableMinWidth}px`,
        fontFamily:
          "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
        fontSize: '0.82rem',
      },
    },
    muiTableContainerProps: {
      sx: {
        maxWidth: '100%',
        overflowX: 'auto',
      },
    },
    muiTableBodyProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
      },
    },
    muiTableHeadProps: {
      sx: {
        backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB',
      },
    },
    muiTableBodyCellProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        color: isDarkMode ? '#E4E7EC' : '#101828',
        borderColor: isDarkMode ? '#344054' : '#E4E7EC',
        display: 'flex',
        alignItems: 'center',
        fontSize: isLaptopViewport ? '0.76rem' : '0.8rem',
        lineHeight: 1.25,
        padding: isLaptopViewport ? '5px 6px' : '6px 8px',
        verticalAlign: 'middle',
        fontFamily:
          "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        '& > a': {
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          color: 'inherit',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        '& .Mui-TableBodyCell-Content': {
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          minHeight: '100%',
        },
      },
    },
    muiTableHeadCellProps: {
      sx: {
        backgroundColor: isDarkMode ? '#1C2434' : '#F9FAFB',
        color: isDarkMode ? '#E4E7EC' : '#344054',
        borderColor: isDarkMode ? '#344054' : '#E4E7EC',
        display: 'flex',
        alignItems: 'center',
        fontWeight: 600,
        fontSize: isLaptopViewport ? '0.74rem' : '0.78rem',
        lineHeight: 1.2,
        padding: isLaptopViewport ? '7px 6px' : '8px 8px',
        verticalAlign: 'middle',
        fontFamily:
          "'Cairo', Outfit, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans'",
        whiteSpace: 'nowrap',
        '& .Mui-TableHeadCell-Content': {
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          minHeight: '100%',
        },
        '& .Mui-TableHeadCell-Content-Wrapper': {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        '& .MuiTableSortLabel-icon': {
          opacity: 0,
          transition: 'opacity 150ms ease',
        },
        '& .MuiTableSortLabel-root.MuiTableSortLabel-active .MuiTableSortLabel-icon': {
          opacity: 1,
        },
        '& .MuiIconButton-root': {
          display: 'none !important',
        },
        overflow: 'visible',
        zIndex: 2,
      },
    },
    muiTopToolbarProps: {
      sx: {
        backgroundColor: isDarkMode ? '#1C2434' : '#FFFFFF',
        color: isDarkMode ? '#E4E7EC' : '#101828',
      },
    },
    muiBottomToolbarProps: {
      sx: {
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        color: isDarkMode ? '#E4E7EC' : '#101828',
      },
    },
    muiTableBodyRowProps: () => ({
      sx: {
        cursor: 'default',
        backgroundColor: isDarkMode ? '#24303F' : '#FFFFFF',
        '&:hover': {
          backgroundColor: isDarkMode ? '#344054' : '#F9FAFB',
        },
      },
    }),
    renderTopToolbarCustomActions: renderTopToolbarCustomActions,
    getRowId: (row) => row._id,
  });

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="w-full overflow-x-auto custom-scrollbar">
        <MaterialReactTable table={table} />
      </div>
    </ThemeProvider>
  );
}

export default ApplicantsTable;