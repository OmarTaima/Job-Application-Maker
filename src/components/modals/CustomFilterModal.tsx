import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  useMediaQuery,
  Slider,
  Box,
  Typography,
  Chip,
  IconButton,
  Paper,
  Stack,
  Badge,
  Collapse,
  Alert,
  InputAdornment,
  FormGroup,
 
  ToggleButton,
  ToggleButtonGroup,
  alpha,
  useTheme,
  Zoom
} from "@mui/material";
import { styled } from '@mui/material/styles';
import { useAuth } from '../../context/AuthContext';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import BusinessIcon from '@mui/icons-material/Business';
import WorkIcon from '@mui/icons-material/Work';
import PersonIcon from '@mui/icons-material/Person';
import WcIcon from '@mui/icons-material/Wc';
import CakeIcon from '@mui/icons-material/Cake';
import DescriptionIcon from '@mui/icons-material/Description';

import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import DateRangeIcon from '@mui/icons-material/DateRange';

type Props = {
  open: boolean;
  onClose: () => void;
  jobPositions: any[];
  applicants?: any[];
  companies?: any[];
  jobPositionMap?: Record<string, any>;
  customFilters: any[];
  setCustomFilters: React.Dispatch<React.SetStateAction<any[]>>;
  columnFilters: any[];
  setColumnFilters: React.Dispatch<React.SetStateAction<any[]>>;
  genderOptions?: Array<{ id: string; title: string }>;
};

// Styled Components
const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  background: `linear-gradient(135deg, ${alpha(((theme.palette as any).brand?.main ?? theme.palette.primary.main), 0.05)} 0%, ${alpha(((theme.palette as any).brand?.light ?? theme.palette.primary.light), 0.02)} 100%)`,
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  padding: theme.spacing(2, 3),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}));

const FilterSection = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: 12,
  backgroundColor: alpha(theme.palette.background.paper, 0.8),
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    borderColor: alpha(((theme.palette as any).brand?.main ?? theme.palette.primary.main), 0.3),
    boxShadow: `0 4px 12px ${alpha(((theme.palette as any).brand?.main ?? theme.palette.primary.main), 0.1)}`,
  },
}));

const SectionTitle = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2),
  '& svg': {
    color: (theme.palette as any).brand?.main ?? theme.palette.primary.main,
    fontSize: 20,
  },
  '& h6': {
    fontWeight: 600,
    fontSize: '0.95rem',
    color: theme.palette.text.primary,
  },
}));

const FilterChip = styled(Chip)(({ theme }) => ({
  borderRadius: 8,
  fontWeight: 500,
  transition: 'all 0.2s ease',
  '&.active': {
    backgroundColor: alpha(((theme.palette as any).brand?.main ?? theme.palette.primary.main), 0.1),
    borderColor: (theme.palette as any).brand?.main ?? theme.palette.primary.main,
    color: (theme.palette as any).brand?.main ?? theme.palette.primary.main,
  },
}));

const StyledToggleButton = styled(ToggleButton)(({ theme }) => ({
  borderRadius: 8,
  padding: '4px 12px',
  fontSize: '0.85rem',
  fontWeight: 500,
  '&.Mui-selected': {
    backgroundColor: alpha(((theme.palette as any).brand?.main ?? theme.palette.primary.main), 0.1),
    color: (theme.palette as any).brand?.main ?? theme.palette.primary.main,
    borderColor: (theme.palette as any).brand?.main ?? theme.palette.primary.main,
    '&:hover': {
      backgroundColor: alpha(((theme.palette as any).brand?.main ?? theme.palette.primary.main), 0.15),
    },
  },
}));

// Helper functions remain the same
export const normalizeLabelSimple = (l: any) => (l || '').toString().replace(/\u200E|\u200F/g, '').replace(/[^\w\u0600-\u06FF\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
export const normalizeForCompare = (s: any) => (s || '').toString().replace(/\u200E|\u200F/g, '').trim().toLowerCase();

export const canonicalMap: Record<string, string[]> = {
  salary: ['expected salary', 'expected_salary', 'الراتب المتوقع', 'الراتب_المتوقع', 'راتب'],
  education_level: ['education level', 'education_level', 'المؤهل الدراسي', 'المؤهل_الدراسي'],
  engineering_specialization: ['engineering specialization', 'engineering_specialization', 'التخصص الهندسي', 'التخصص_الهندسي', 'engineering specializaion', 'engineering_specializaion'],
};

export const getCanonicalType = (f: any) => {
  if (!f) return undefined;
  try {
    const lbl = normalizeLabelSimple(`${f.labelEn || f.label?.en || ''} ${f.labelAr || f.label?.ar || ''} ${f.fieldId || ''}`);
    for (const [k, vals] of Object.entries(canonicalMap)) {
      for (const v of vals) {
        const nv = normalizeLabelSimple(v);
        if (!nv) continue;
        if (lbl.includes(nv) || nv.includes(lbl) || String(f.fieldId || '').toLowerCase().includes(nv)) return k;
      }
    }
  } catch (e) {
    // ignore
  }
  return undefined;
};

export const getCustomResponseValue = (a: any, f: any) => {
  if (!a) return '';
  const responses = a.customResponses || a.customFieldResponses || {};
  const top = a || {};

  const tryKey = (k: any) => {
    if (k === undefined || k === null) return undefined;
    if (typeof k !== 'string' && typeof k !== 'number') return undefined;
    const key = String(k);
    if (responses && Object.prototype.hasOwnProperty.call(responses, key)) return responses[key];
    if (top && Object.prototype.hasOwnProperty.call(top, key)) return top[key];
    return undefined;
  };

  const byId = tryKey(f.fieldId);
  if (byId !== undefined) return byId;
  const byEn = tryKey(f.labelEn);
  if (byEn !== undefined) return byEn;
  const byAr = tryKey(f.labelAr);
  if (byAr !== undefined) return byAr;
  const byLabel = tryKey(f.label);
  if (byLabel !== undefined) return byLabel;

  const norm = (s: any) => (s || '').toString().replace(/\u200E|\u200F/g, '').replace(/[^\w\u0600-\u06FF\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const rawTargets = [f.labelEn, f.labelAr, f.fieldId].filter(Boolean);
  const targetSet = new Set<string>();
  rawTargets.map(norm).forEach((t) => {
    if (!t) return;
    targetSet.add(t);
    targetSet.add(t.replace(/\s+/g, '_'));
    targetSet.add(t.replace(/_/g, ' '));
  });

  const canonical = getCanonicalType(f);
  if (canonical && canonicalMap[canonical]) {
    const allowed = canonicalMap[canonical].map((s) => normalizeLabelSimple(s));
    for (const [k, v] of Object.entries(responses || {})) {
      try {
        const nk = normalizeLabelSimple(k);
        if (allowed.includes(nk) || allowed.some((al) => nk.includes(al) || al.includes(nk))) return v;
      } catch (e) {
        // ignore
      }
    }
  }

  try {
    for (const [k, v] of Object.entries(responses || {})) {
      try {
        const nk = normalizeLabelSimple(k);
        if (!nk) continue;
        if (targetSet.has(nk) || targetSet.has(nk.replace(/_/g, ' ')) || targetSet.has(nk.replace(/\s+/g, '_'))) return v;
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
  return '';
};

export const extractResponseItems = (raw: any): string[] => {
  if (raw === null || raw === undefined) return [];
  const pickFromObject = (o: any) => {
    if (o === null || o === undefined) return '';
    if (typeof o === 'number') return String(o);
    if (typeof o === 'string') return o;
    return (o.id ?? o._id ?? o.value ?? o.val ?? o.en ?? o.ar ?? o.label ?? o.name ?? '') + '';
  };
  if (Array.isArray(raw)) return raw.map(pickFromObject).filter((s) => s !== '');
  if (typeof raw === 'object') {
    const candidates: string[] = [];
    const prim = pickFromObject(raw);
    if (prim) candidates.push(prim);
    Object.entries(raw).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      if (typeof v === 'object') return;
      if (typeof v === 'boolean') {
        if (v) candidates.push(String(k));
        return;
      }
      candidates.push(String(v));
      candidates.push(String(k));
    });
    return Array.from(new Set(candidates)).filter((s) => s !== '');
  }
  return [String(raw)];
};

export const expandForms = (s: string) => {
  const out = new Set<string>();
  if (!s) return [] as string[];
  out.add(s);
  out.add(s.replace(/\s+/g, '_'));
  out.add(s.replace(/_/g, ' '));
  return Array.from(out);
};

try {
  (window as any).__customFilterHelpers = { getCustomResponseValue, extractResponseItems, expandForms, getCanonicalType, canonicalMap };
} catch (e) {
  // ignore
}

export const buildFieldToJobIds = (jobPositions: any[]) => {
  const map: Record<string, Set<string>> = {};
  const getId = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');
  (jobPositions || []).forEach((job: any) => {
    const jid = getId(job._id) || getId(job.id);
    if (!jid) return;
    if (!Array.isArray(job.customFields)) return;
    job.customFields.forEach((cf: any) => {
      const raw = `${cf.label?.en || ''} ${cf.label?.ar || ''} ${cf.fieldId || ''}`;
      const key = normalizeLabelSimple(raw) || String(cf.fieldId || '');
      if (!map[key]) map[key] = new Set<string>();
      map[key].add(String(jid));
      if (cf.fieldId) {
        const fid = String(cf.fieldId);
        if (!map[fid]) map[fid] = new Set<string>();
        map[fid].add(String(jid));
      }
      try {
        const canon = getCanonicalType(cf) || getCanonicalType({ label: cf.label, fieldId: cf.fieldId });
        if (canon) {
          if (!map[canon]) map[canon] = new Set<string>();
          map[canon].add(String(jid));
          const variants = canonicalMap[canon] || [];
          variants.forEach((v) => {
            const nk = normalizeLabelSimple(v);
            if (!map[nk]) map[nk] = new Set<string>();
            map[nk].add(String(jid));
          });
        }
      } catch (e) {
        // ignore
      }
    });
  });
  return map;
};

const _excludedRaw: string[] = [];
const _excludedSet = new Set(_excludedRaw.map((r) => normalizeLabelSimple(r)));
export const isExcludedLabel = (rawLabel: any) => {
  try {
    const n = normalizeLabelSimple(rawLabel || '');
    for (const ex of Array.from(_excludedSet)) {
      if (!ex) continue;
      if (n.includes(ex) || ex.includes(n)) return true;
    }
  } catch (e) {
    // ignore
  }
  return false;
};

const CustomFilterModal: React.FC<Props> = ({ 
  open, 
  onClose, 
  jobPositions = [], 
  applicants = [], 
  customFilters = [], 
  setCustomFilters, 
  columnFilters = [], 
  setColumnFilters, 
  genderOptions = [], 
  companies = [] 
}) => {
  const theme = useTheme();
  const brandMain = (theme.palette as any).brand?.main ?? theme.palette.primary.main;
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isVerySmall = useMediaQuery('(max-width:425px)');
  const { user } = useAuth();
  const [modalSelectedJobIds, setModalSelectedJobIds] = useState<string[]>([]);
  const [modalSelectedCompanyIds, setModalSelectedCompanyIds] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    companies: true,
    jobs: true,
    personal: true,
    custom: true
  });
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const userAssignedCompanyIds = (user?.companies?.map((c: any) => (typeof c.companyId === 'string' ? c.companyId : c.companyId?._id)).filter(Boolean)) || [];
  const isSingleAssignedCompany = Array.isArray(userAssignedCompanyIds) && userAssignedCompanyIds.length === 1;

  useEffect(() => {
    // Count active filters
    let count = customFilters.length;
    if (modalSelectedCompanyIds.length > 0) count++;
    if (modalSelectedJobIds.length > 0) count++;
    setActiveFilterCount(count);
  }, [customFilters, modalSelectedCompanyIds, modalSelectedJobIds]);

  const deriveCompaniesList = (c: any): any[] => {
    if (!c) return [];
    if (Array.isArray(c)) return c;
    if (Array.isArray(c.data)) return c.data;
    if (Array.isArray(c.items)) return c.items;
    if (Array.isArray(c.rows)) return c.rows;
    if (Array.isArray(c.companies)) return c.companies;
    return [];
  };
  const companiesList = deriveCompaniesList(companies);

  const getDisplayText = (v: any): string => {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      if (typeof v.en === 'string' && v.en.trim()) return v.en;
      if (typeof v.ar === 'string' && v.ar.trim()) return v.ar;
      if (typeof v.name === 'string' && v.name.trim()) return v.name;
      if (typeof v.companyName === 'string' && v.companyName.trim()) return v.companyName;
      if (v.title && typeof v.title === 'string') return v.title;
      return String(v.en ?? v.ar ?? v.name ?? v.companyName ?? v.title ?? JSON.stringify(v));
    }
    return String(v);
  };

  useEffect(() => {
    try {
      const jf = Array.isArray(columnFilters) ? columnFilters.find((c: any) => c.id === 'jobPositionId') : undefined;
      if (jf && Array.isArray(jf.value)) setModalSelectedJobIds(jf.value.map(String));
      const cf = Array.isArray(columnFilters) ? columnFilters.find((c: any) => c.id === 'companyId') : undefined;
      if (cf && Array.isArray(cf.value)) setModalSelectedCompanyIds(cf.value.map(String));
      else {
        try {
          if (isSingleAssignedCompany) {
            setModalSelectedCompanyIds([String(userAssignedCompanyIds[0])]);
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }
  }, [open, columnFilters]);

  // Child component extracted to avoid calling hooks inside render loops
  const SalaryRangeControl: React.FC<{
    f: any;
    existing: any;
    applicants: any[];
    saveFieldId: string;
  }> = ({ f, existing, applicants, saveFieldId }) => {
    const extractNumbers = (raw: any): number[] => {
      if (raw === null || raw === undefined) return [];
      if (typeof raw === 'number') return [raw];
      let s = String(raw).trim();
      if (!s) return [];

      const convDigits = (str: string) => {
        const map: Record<string,string> = {
          '\u0660':'0','\u0661':'1','\u0662':'2','\u0663':'3','\u0664':'4','\u0665':'5','\u0666':'6','\u0667':'7','\u0668':'8','\u0669':'9',
          '\u06F0':'0','\u06F1':'1','\u06F2':'2','\u06F3':'3','\u06F4':'4','\u06F5':'5','\u06F6':'6','\u06F7':'7','\u06F8':'8','\u06F9':'9'
        };
        return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => map[ch] || ch);
      };

      s = convDigits(s);
      // Try to find all numeric substrings (handles ranges like "6000:9000", "6,000 - 9,000", "6000 to 9000")
      const matches = s.match(/-?\d[\d,\.]*|\d+/g);
      if (matches && matches.length > 0) {
        const nums: number[] = [];
        for (const m of matches) {
          const cleaned = m.replace(/,/g, '');
          const v = Number(cleaned);
          if (Number.isFinite(v)) nums.push(v);
        }
        return nums;
      }

      // Fallback: strip non-numeric and parse
      const cleanedAll = s.replace(/[^0-9.\-]/g, '');
      const p = Number(cleanedAll);
      return Number.isFinite(p) ? [p] : [];
    };

    const numsWithId: Array<{n:number,id:string}> = [];
    (applicants || []).forEach((a: any) => {
      try {
        const aid = String(a?._id || a?.id || '') || '';
        const rv = getCustomResponseValue(a, f);
        const items = extractResponseItems(rv);
        for (const it of items) {
          const found = extractNumbers(it);
          for (const n of found) if (Number.isFinite(n)) numsWithId.push({ n, id: aid });
        }
        const topVals = [a?.expectedSalary, a?.expected_salary, a?.expected];
        for (const tv of topVals) {
          const found = extractNumbers(tv);
          for (const tn of found) if (Number.isFinite(tn)) numsWithId.push({ n: tn, id: aid });
        }
      } catch (e) { /* ignore */ }
    });

    // Exclude zero values from observed salaries (ignore 0 entries) and keep ids
    const validEntries = numsWithId.filter((entry) => Number.isFinite(entry.n) && entry.n > 0).sort((a,b)=>a.n-b.n);
    // Ensure observed range is non-negative (salaries shouldn't be negative)
    let observedMin = validEntries.length ? validEntries[0].n : 0;
    let observedMax = validEntries.length ? Math.max(observedMin, validEntries[validEntries.length - 1].n) : observedMin + 1000;
    // Log lowest value and its applicant id for debugging
    if (validEntries.length) {
      try {
        const minEntry = validEntries[0];
        console.log('SalaryRangeControl lowest observed expected salary:', minEntry.n, 'applicantId:', minEntry.id);
      } catch (e) { /* ignore */ }
    }
    if (observedMax <= observedMin) observedMax = observedMin + Math.max(100, Math.abs(observedMin || 1000));

    const rawSelMin = (existing.value && (existing.value.min !== undefined && existing.value.min !== '')) ? Number(existing.value.min) : observedMin;
    const rawSelMax = (existing.value && (existing.value.max !== undefined && existing.value.max !== '')) ? Number(existing.value.max) : observedMax;
    const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
    let selMin = clamp(rawSelMin, observedMin, observedMax);
    let selMax = clamp(rawSelMax, observedMin, observedMax);
    if (selMin > selMax) { const t = selMin; selMin = selMax; selMax = t; }

    const [range, setRange] = useState<[number,number]>([selMin, selMax]);

    useEffect(() => {
      const newMin = Math.min(Math.max(selMin, observedMin), observedMax);
      const newMax = Math.min(Math.max(selMax, observedMin), observedMax);
      const a = Math.min(newMin, newMax);
      const b = Math.max(newMin, newMax);
      setRange([a, b]);
    }, [selMin, selMax, observedMin, observedMax]);

    const commitRange = (v: [number, number]) => {
      setCustomFilters((prev: any) => {
        const next = prev.filter((p: any) => p.fieldId !== saveFieldId);
        const fullMin = observedMin;
        const fullMax = observedMax;
        if (v[0] <= fullMin && v[1] >= fullMax) {
          return next;
        }
        next.push({
          fieldId: saveFieldId,
          labelEn: f.label?.en,
          labelAr: f.label?.ar,
          type: 'range',
          value: { min: v[0], max: v[1] },
          choices: f.choices,
        });
        return next;
      });
    };

    const clampValue = (v: number) => Math.min(Math.max(Number.isFinite(v) ? v : 0, observedMin), observedMax);

    return (
      <Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
            <TextField
            size="small"
            type="number"
            label="Min"
            value={Number.isFinite(range[0]) ? range[0] : ''}
            onChange={(e) => {
              const v = e.target.value === '' ? observedMin : Number(e.target.value);
              setRange(([_, r1]) => [isNaN(v) ? observedMin : clampValue(v), r1]);
            }}
            onBlur={() => {
              const newMin = clampValue(range[0]);
              const newMax = clampValue(range[1]);
              const a = Math.min(newMin, newMax);
              const b = Math.max(newMin, newMax);
              setRange([a, b]);
              commitRange([a, b]);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const newMin = clampValue(range[0]);
                const newMax = clampValue(range[1]);
                const a = Math.min(newMin, newMax);
                const b = Math.max(newMin, newMax);
                setRange([a, b]);
                commitRange([a, b]);
              }
            }}
            sx={{ width: 140 }}
            InputProps={{ inputProps: { min: observedMin, max: observedMax, step: 'any' } }}
          />

          <TextField
            size="small"
            type="number"
            label="Max"
            value={Number.isFinite(range[1]) ? range[1] : ''}
            onChange={(e) => {
              const v = e.target.value === '' ? observedMax : Number(e.target.value);
              setRange(([r0, _]) => [r0, isNaN(v) ? observedMax : clampValue(v)]);
            }}
            onBlur={() => {
              const newMin = clampValue(range[0]);
              const newMax = clampValue(range[1]);
              const a = Math.min(newMin, newMax);
              const b = Math.max(newMin, newMax);
              setRange([a, b]);
              commitRange([a, b]);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const newMin = clampValue(range[0]);
                const newMax = clampValue(range[1]);
                const a = Math.min(newMin, newMax);
                const b = Math.max(newMin, newMax);
                setRange([a, b]);
                commitRange([a, b]);
              }
            }}
            sx={{ width: 140 }}
            InputProps={{ inputProps: { min: observedMin, max: observedMax, step: 'any' } }}
          />

          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Range: {Number(range[0]).toLocaleString()} — {Number(range[1]).toLocaleString()}
            </Typography>
          </Box>
        </Box>

        <Slider
          step={null}
          value={range}
          onChange={(_, val) => setRange(val as [number,number])}
          onChangeCommitted={(_, val) => {
            const v = val as [number,number];
            commitRange(v);
          }}
          min={observedMin}
          max={observedMax}
          valueLabelDisplay="off"
          valueLabelFormat={(v) => Number(v).toLocaleString()}
          disableSwap
          sx={{ mt: 2 }}
        />
      </Box>
    );
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('applicants_table_state');
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.customFilters = customFilters || [];
      parsed.columnFilters = columnFilters || parsed.columnFilters || [];
      const str = JSON.stringify(parsed);
      sessionStorage.setItem('applicants_table_state', str);
      try { localStorage.setItem('applicants_table_state', str); } catch (e) { /* ignore */ }
    } catch (e) {
      // ignore
    }
  }, [customFilters, columnFilters]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleClearAll = () => {
    setCustomFilters([]);
    setModalSelectedJobIds([]);
    setModalSelectedCompanyIds([]);
    setColumnFilters(prev => {
      const next = Array.isArray(prev) ? prev.filter((p: any) => p.id !== 'jobPositionId' && p.id !== 'companyId') : prev;
      try {
        const raw = sessionStorage.getItem('applicants_table_state');
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.columnFilters = next;
        parsed.customFilters = [];
        const str = JSON.stringify(parsed);
        sessionStorage.setItem('applicants_table_state', str);
        try { localStorage.setItem('applicants_table_state', str); } catch (e) { /* ignore */ }
      } catch (e) {
        // ignore
      }
      return next as any;
    });
    onClose();
  };

  const handleRevert = () => {
    setCustomFilters(prev => {
      const prevArr = Array.isArray(prev) ? [...prev] : [];

      const presenceIds = new Set<string>();
      presenceIds.add('__has_cv');

      const getId = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');
      const map: Record<string, any> = {};
      (jobPositions || []).forEach((job: any) => {
        const jid = getId(job._id) || getId(job.id);
        if (!jid) return;
        if (!Array.isArray(job.customFields)) return;
        job.customFields.forEach((cf: any) => {
          const labelOnly = (cf.label?.en || cf.label?.ar || cf.label || '').toString();
          const key = normalizeLabelSimple(labelOnly) || String(cf.fieldId || '');
          if (!key) return;
          if (!map[key]) map[key] = { ...(cf || {}), jobs: new Set<string>([String(jid)]) };
          else {
            const existing = map[key];
            if (Array.isArray(existing.choices) && Array.isArray(cf.choices)) {
              const merged = Array.from(new Set([...(existing.choices || []).map(JSON.stringify), ...cf.choices.map(JSON.stringify)])).map((s) => JSON.parse(s));
              existing.choices = merged;
            } else if (!existing.choices && Array.isArray(cf.choices)) {
              existing.choices = cf.choices;
            }
            existing.jobs.add(String(jid));
          }
        });
      });
      const fields = Object.values(map).map((v: any) => ({ ...v, jobs: Array.from(v.jobs) }));

      fields.forEach((f: any) => {
        try {
          const rawLabel = `${f.label?.en || ''} ${f.label?.ar || ''}`;
          const fieldKeyNormalized = normalizeLabelSimple(rawLabel) || String(f.fieldId || '');
          const saveFieldId = f.fieldId ?? fieldKeyNormalized;
          // Skip salary/expected salary fields (now available on top-level applicant.expectedSalary)
          const canon = getCanonicalType(f) || getCanonicalType({ label: f.label, fieldId: f.fieldId });
          if (canon === 'salary') return;
          presenceIds.add(String(saveFieldId));
        } catch (e) {
          // ignore
        }
      });

      prevArr.forEach((p: any) => {
        try {
          if (p && typeof p.type === 'string' && p.type.toLowerCase().startsWith('has')) presenceIds.add(String(p.fieldId));
        } catch (e) { /* ignore */ }
      });

      const birthFieldIds = new Set<string>();
      fields.forEach((f: any) => {
        try {
          const rawLabel = `${f.label?.en || ''} ${f.label?.ar || ''}`;
          const fieldKeyNormalized = normalizeLabelSimple(rawLabel) || String(f.fieldId || '');
          const isBirthdate = /birthdate|date of birth|تarih|تاريخ الميلاد/.test(normalizeForCompare(rawLabel));
          if (isBirthdate) birthFieldIds.add(String(f.fieldId ?? fieldKeyNormalized));
        } catch (e) { /* ignore */ }
      });

      const next = prevArr.map((p: any) => {
        try {
          if (!p) return p;
          const fid = String(p.fieldId || '');
          if (p.type === 'birthYear' || birthFieldIds.has(fid)) {
            const cur = p.value || {};
            const curMode = cur.mode || 'after';
            const newMode = curMode === 'after' ? 'before' : 'after';
            const newVal = { ...(cur || {}), mode: newMode };
            return { ...p, value: newVal };
          }
          if (presenceIds.has(fid)) {
            const newVal = p.value === true ? false : (p.value === false ? true : true);
            return { ...p, value: newVal };
          }
        } catch (e) { /* ignore */ }
        return p;
      }).filter(Boolean);

      try {
        const raw = sessionStorage.getItem('applicants_table_state');
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.customFilters = next;
        const str = JSON.stringify(parsed);
        sessionStorage.setItem('applicants_table_state', str);
        try { localStorage.setItem('applicants_table_state', str); } catch (e) { /* ignore */ }
      } catch (e) { /* ignore */ }

      return next;
    });
  };

  const handleSave = () => {
    onClose();
    setColumnFilters(prev => {
      const base = Array.isArray(prev) ? prev.filter((p: any) => p.id !== 'jobPositionId' && p.id !== 'companyId') : [];
      const next = Array.isArray(base) ? [...base] : [];
      if (modalSelectedCompanyIds && modalSelectedCompanyIds.length > 0) {
        next.push({ id: 'companyId', value: modalSelectedCompanyIds });
      }
      if (modalSelectedJobIds && modalSelectedJobIds.length > 0) {
        next.push({ id: 'jobPositionId', value: modalSelectedJobIds });
      }
      try {
        const raw = sessionStorage.getItem('applicants_table_state');
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.columnFilters = next;
        parsed.customFilters = customFilters || [];
        const str = JSON.stringify(parsed);
        sessionStorage.setItem('applicants_table_state', str);
        try { localStorage.setItem('applicants_table_state', str); } catch (e) { /* ignore */ }
      } catch (e) {
        // ignore
      }
      return next as any;
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile && !isVerySmall}
      TransitionComponent={Zoom}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          overflow: 'hidden',
          maxHeight: isVerySmall ? '75vh' : undefined,
          margin: isVerySmall ? 2 : undefined,
        }
      }}
    >
      <StyledDialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon sx={{ color: brandMain }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Custom Filter Settings
          </Typography>
          {activeFilterCount > 0 && (
            <Badge
              badgeContent={activeFilterCount}
              color="primary"
              sx={{ ml: 1 }}
            />
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </StyledDialogTitle>

      <DialogContent 
        sx={{ 
          p: isVerySmall ? 2 : (isMobile ? 2 : 3),
          bgcolor: alpha(brandMain, 0.02),
        }}
      >
        <Stack spacing={2}>
          {/* Companies Section */}
          {!isSingleAssignedCompany && (
            <FilterSection elevation={0}>
              <Box 
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => toggleSection('companies')}
              >
                <SectionTitle>
                  <BusinessIcon />
                  <Typography variant="h6">Companies</Typography>
                </SectionTitle>
                <IconButton size="small">
                  {expandedSections.companies ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              
              <Collapse in={expandedSections.companies}>
                <Box sx={{ mt: 2 }}>
                  <FormGroup sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
                    {companiesList.map((comp: any) => {
                      const cid = (comp._id || comp.id) || '';
                      const title = getDisplayText(comp?.name || comp?.companyName || comp?.title || comp?.title?.en || cid) || cid;
                      const isSelected = modalSelectedCompanyIds.includes(String(cid));
                      return (
                        <FilterChip
                          key={cid}
                          label={title}
                          onClick={() => {
                            setModalSelectedCompanyIds(prev => {
                              if (isSelected) return prev.filter((x) => x !== String(cid));
                              return [...prev, String(cid)];
                            });
                          }}
                          color={isSelected ? 'primary' : 'default'}
                          variant={isSelected ? 'filled' : 'outlined'}
                          className={isSelected ? 'active' : ''}
                          icon={isSelected ? <CheckCircleIcon /> : undefined}
                        />
                      );
                    })}
                  </FormGroup>
                </Box>
              </Collapse>
            </FilterSection>
          )}

          {/* Jobs Section */}
          <FilterSection elevation={0}>
            <Box 
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => toggleSection('jobs')}
            >
              <SectionTitle>
                <WorkIcon />
                <Typography variant="h6">Job Positions</Typography>
              </SectionTitle>
              <IconButton size="small">
                {expandedSections.jobs ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            
            <Collapse in={expandedSections.jobs}>
              <Box sx={{ mt: 2 }}>
                {modalSelectedCompanyIds.length === 0 ? (
                  <Alert 
                    severity="info" 
                    icon={<InfoIcon />}
                    sx={{ borderRadius: 2 }}
                  >
                    Select one or more companies to display their jobs.
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    {(() => {
                      const jobsByCompany: Record<string, any[]> = {};
                      const getCid = (job: any) => {
                        const rawCid = job.companyId || job.company || job.companyObj;
                        if (!rawCid) return '';
                        if (typeof rawCid === 'string') return rawCid;
                        return rawCid._id || rawCid.id || '';
                      };
                      const getJid = (job: any) => (typeof job._id === 'string' ? job._id : (job._id?._id || job._id?.id || job.id || '')) || '';
                      
                      (jobPositions || []).forEach((job: any) => {
                        const cid = String(getCid(job) || '');
                        if (!cid) return;
                        if (!jobsByCompany[cid]) jobsByCompany[cid] = [];
                        jobsByCompany[cid].push(job);
                      });

                      return modalSelectedCompanyIds.map((selCid) => {
                        const jobs = jobsByCompany[String(selCid)] || [];
                        const comp = companiesList.find((c: any) => String(c._id || c.id) === String(selCid));
                        const compTitle = comp ? getDisplayText(comp.name || comp.companyName || comp.title || comp.title?.en || selCid) : selCid;
                        
                        return (
                          <Paper key={selCid} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: brandMain }}>
                              {compTitle}
                            </Typography>
                            {jobs.length === 0 ? (
                              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                No jobs for this company.
                              </Typography>
                            ) : (
                              <FormGroup sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
                                {jobs.map((job: any) => {
                                  const jid = String(getJid(job));
                                  const title = getDisplayText(job.title || job.name || jid) || jid;
                                  const isSelected = modalSelectedJobIds.includes(String(jid));
                                  return (
                                    <FilterChip
                                      key={jid}
                                      label={title}
                                      onClick={() => {
                                        setModalSelectedJobIds(prev => {
                                          if (isSelected) return prev.filter((x) => x !== String(jid));
                                          return [...prev, String(jid)];
                                        });
                                      }}
                                      color={isSelected ? 'primary' : 'default'}
                                      variant={isSelected ? 'filled' : 'outlined'}
                                      className={isSelected ? 'active' : ''}
                                      icon={isSelected ? <CheckCircleIcon /> : undefined}
                                      size="small"
                                    />
                                  );
                                })}
                              </FormGroup>
                            )}
                          </Paper>
                        );
                      });
                    })()}
                  </Stack>
                )}
              </Box>
            </Collapse>
          </FilterSection>

          {/* Personal Information Section */}
          <FilterSection elevation={0}>
            <Box 
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => toggleSection('personal')}
            >
              <SectionTitle>
                <PersonIcon />
                <Typography variant="h6">Personal Information</Typography>
              </SectionTitle>
              <IconButton size="small">
                {expandedSections.personal ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            
            <Collapse in={expandedSections.personal}>
              <Stack spacing={3} sx={{ mt: 2 }}>
                {/* Gender */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WcIcon fontSize="small" color="primary" />
                    Gender
                  </Typography>
                  <FormGroup sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
                    {(genderOptions || []).map((opt: any) => {
                      const existing = customFilters.find((cf: any) => cf.fieldId === '__gender') || {};
                      const selected = Array.isArray(existing.value) ? existing.value : (existing.value ? [existing.value] : []);
                      const isSelected = selected.includes(opt.id);
                      return (
                        <FormControlLabel
                          key={opt.id}
                          control={
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              icon={<CheckBoxOutlineBlankIcon />}
                              checkedIcon={<CheckBoxIcon />}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setCustomFilters(prev => {
                                  const next = prev.filter((p: any) => p.fieldId !== '__gender');
                                  let vals = Array.isArray(existing.value) ? [...existing.value] : [];
                                  if (checked) vals = [...new Set([...vals, opt.id])];
                                  else vals = vals.filter((v: any) => v !== opt.id);
                                  if (vals.length) {
                                    next.push({ 
                                      fieldId: '__gender', 
                                      labelEn: 'Gender', 
                                      labelAr: 'النوع', 
                                      type: 'multi', 
                                      value: vals, 
                                      choices: (genderOptions || []).map((o: any) => ({ en: o.title, id: o.id })) 
                                    });
                                  }
                                  return next;
                                });
                              }}
                            />
                          }
                          label={<Typography variant="body2">{opt.title}</Typography>}
                        />
                      );
                    })}
                  </FormGroup>
                </Box>

                {/* Birth Date */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CakeIcon fontSize="small" color="primary" />
                    Birth Date
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'center' } }}>
                    {(() => {
                      const existing = customFilters.find((cf: any) => cf.fieldId === '__birthdate') || {};
                      const yearVal = existing.value?.year ?? '';
                      const modeVal = existing.value?.mode ?? 'after';
                      return (
                        <>
                          <TextField
                            size="small"
                            type="number"
                            label="Year"
                            value={yearVal}
                            onChange={(e) => {
                              const nv = e.target.value;
                              const parsed = nv ? Number(nv) : '';
                              setCustomFilters(prev => {
                                const next = prev.filter((p: any) => p.fieldId !== '__birthdate');
                                if (nv) {
                                  next.push({ 
                                    fieldId: '__birthdate', 
                                    labelEn: 'Birth Date', 
                                    labelAr: 'تاريخ الميلاد', 
                                    type: 'birthYear', 
                                    value: { year: parsed, mode: modeVal } 
                                  });
                                }
                                return next;
                              });
                            }}
                            sx={{ minWidth: 100 }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <DateRangeIcon fontSize="small" color="action" />
                                </InputAdornment>
                              ),
                            }}
                          />
                          <ToggleButtonGroup
                            value={modeVal}
                            exclusive
                            onChange={(_, newMode) => {
                              if (newMode) {
                                setCustomFilters(prev => {
                                  const next = prev.filter((p: any) => p.fieldId !== '__birthdate');
                                  if (yearVal) {
                                    next.push({ 
                                      fieldId: '__birthdate', 
                                      labelEn: 'Birth Date', 
                                      labelAr: 'تاريخ الميلاد', 
                                      type: 'birthYear', 
                                      value: { year: Number(yearVal), mode: newMode } 
                                    });
                                  }
                                  return next;
                                });
                              }
                            }}
                            size="small"
                          >
                            <StyledToggleButton value="after">After</StyledToggleButton>
                            <StyledToggleButton value="before">Before</StyledToggleButton>
                          </ToggleButtonGroup>
                          {yearVal && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => {
                                setCustomFilters(prev => prev.filter((p: any) => p.fieldId !== '__birthdate'));
                              }}
                            >
                              Clear
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </Box>
                </Box>

                {/* Has CV */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DescriptionIcon fontSize="small" color="primary" />
                    CV Status
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {(() => {
                      const existing = customFilters.find((cf: any) => cf.fieldId === '__has_cv') || {};
                      const isHas = existing.value === true;
                      const isNo = existing.value === false;
                      return (
                        <ToggleButtonGroup
                          value={isHas ? 'has' : isNo ? 'no' : null}
                          exclusive
                          size="small"
                        >
                          <StyledToggleButton
                            value="has"
                            onClick={() => {
                              setCustomFilters(prev => {
                                if (isHas) return prev.filter((p: any) => p.fieldId !== '__has_cv');
                                const next = prev.filter((p: any) => p.fieldId !== '__has_cv');
                                next.push({ 
                                  fieldId: '__has_cv', 
                                  labelEn: 'Has CV', 
                                  labelAr: 'لديه سيرة ذاتية', 
                                  type: 'hasCV', 
                                  value: true 
                                });
                                return next;
                              });
                            }}
                          >
                            Has CV
                          </StyledToggleButton>
                          <StyledToggleButton
                            value="no"
                            onClick={() => {
                              setCustomFilters(prev => {
                                if (isNo) return prev.filter((p: any) => p.fieldId !== '__has_cv');
                                const next = prev.filter((p: any) => p.fieldId !== '__has_cv');
                                next.push({ 
                                  fieldId: '__has_cv', 
                                  labelEn: 'Has CV', 
                                  labelAr: 'لديه سيرة ذاتية', 
                                  type: 'hasCV', 
                                  value: false 
                                });
                                return next;
                              });
                            }}
                          >
                            No CV
                          </StyledToggleButton>
                        </ToggleButtonGroup>
                      );
                    })()}
                  </Box>
                  </Box>

                  {/* Expected Salary (always present) */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DescriptionIcon fontSize="small" color="primary" />
                      Expected Salary
                    </Typography>
                    <Box>
                      {(() => {
                        const existing = customFilters.find((cf: any) => cf.fieldId === '__expectedSalary') || {};
                        const fakeField = { label: { en: 'Expected Salary' }, fieldId: '__expectedSalary' } as any;
                        return (
                          <SalaryRangeControl f={fakeField} existing={existing} applicants={applicants || []} saveFieldId={'__expectedSalary'} />
                        );
                      })()}
                    </Box>
                  </Box>
              </Stack>
            </Collapse>
          </FilterSection>

          {/* Custom Fields Section */}
          <FilterSection elevation={0}>
            <Box 
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => toggleSection('custom')}
            >
              <SectionTitle>
                <FilterListIcon />
                <Typography variant="h6">Custom Fields</Typography>
              </SectionTitle>
              <IconButton size="small">
                {expandedSections.custom ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            
            <Collapse in={expandedSections.custom}>
              <Box sx={{ mt: 2 }}>
                {modalSelectedJobIds.length === 0 ? (
                  <Alert 
                    severity="info" 
                    icon={<InfoIcon />}
                    sx={{ borderRadius: 2 }}
                  >
                    Select one or more jobs to display their custom fields.
                  </Alert>
                ) : (
                  (() => {
                    const map: Record<string, any> = {};
                    const getId = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');
                    (jobPositions || []).forEach((job: any) => {
                      const jid = getId(job._id) || getId(job.id);
                      if (!jid) return;
                      if (modalSelectedJobIds.length > 0 && !modalSelectedJobIds.includes(String(jid))) return;
                      if (!Array.isArray(job.customFields)) return;
                      job.customFields.forEach((cf: any) => {
                        const labelOnly = (cf.label?.en || cf.label?.ar || cf.label || '').toString();
                        const key = normalizeLabelSimple(labelOnly) || String(cf.fieldId || '');
                        if (!key) return;
                        if (!map[key]) map[key] = { ...(cf || {}), jobs: new Set<string>([String(jid)]) };
                        else {
                          const existing = map[key];
                          if (Array.isArray(existing.choices) && Array.isArray(cf.choices)) {
                            const merged = Array.from(new Set([...(existing.choices || []).map(JSON.stringify), ...cf.choices.map(JSON.stringify)])).map((s) => JSON.parse(s));
                            existing.choices = merged;
                          } else if (!existing.choices && Array.isArray(cf.choices)) {
                            existing.choices = cf.choices;
                          }
                          existing.jobs.add(String(jid));
                        }
                      });
                    });
                    const fields = Object.values(map).map((v: any) => ({ ...v, jobs: Array.from(v.jobs) }));
                    
                    if (!fields.length) {
                      return (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 3 }}>
                          No custom fields found for selected jobs.
                        </Typography>
                      );
                    }

                    return (
                      <Stack spacing={3}>
                        {fields.map((f: any) => {
                          try {
                            const rawLabel = `${f.label?.en || ''} ${f.label?.ar || ''}`;
                            if (isExcludedLabel(rawLabel)) return null;
                            const fieldKeyNormalized = normalizeLabelSimple(rawLabel) || String(f.fieldId || '');
                            const existing = customFilters.find((cf: any) => {
                              try {
                                if (cf.fieldId && String(cf.fieldId) === String(f.fieldId)) return true;
                                const cfLabelNorm = normalizeLabelSimple(cf.labelEn || cf.label || cf.labelAr || '');
                                if (cfLabelNorm && cfLabelNorm === fieldKeyNormalized) return true;
                              } catch (e) {
                                // ignore
                              }
                              return false;
                            }) || {};
                            const saveFieldId = f.fieldId ?? fieldKeyNormalized;

                            // Skip canonical salary fields — those are now top-level `applicant.expectedSalary`
                            const canon = getCanonicalType(f) || getCanonicalType({ label: f.label, fieldId: f.fieldId });
                            if (canon === 'salary') return null;

                            return (
                              <Paper key={saveFieldId} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: brandMain }}>
                                  {f.label?.en || f.label?.ar || 'Custom Field'}
                                </Typography>

                                {/* If field has explicit choices, render them as selectable chips (multi-select) */}
                                {Array.isArray(f.choices) && f.choices.length > 0 ? (
                                  <Box>
                                    <Typography variant="body2" sx={{ mb: 1 }}>Select options:</Typography>
                                    <FormGroup sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
                                      {f.choices
                                        .map((c: any) => ({ id: c.en || c.ar || String(c), title: `${c.en || ''}${c.ar ? ' / ' + c.ar : ''}` }))
                                        .filter((ch: any, index: number, self: any[]) => index === self.findIndex((t) => t.id === ch.id))
                                        .map((ch: any) => {
                                          const sel = Array.isArray(existing.value) ? existing.value : [];
                                          const isSelected = sel.includes(ch.id);
                                          return (
                                            <FilterChip
                                              key={ch.id}
                                              label={ch.title}
                                              onClick={() => {
                                                setCustomFilters(prev => {
                                                  const next = prev.filter((p: any) => p.fieldId !== saveFieldId);
                                                  let vals = Array.isArray(existing.value) ? [...existing.value] : [];
                                                  if (isSelected) vals = vals.filter((v: any) => v !== ch.id);
                                                  else vals = [...new Set([...vals, ch.id])];
                                                  if (vals.length) {
                                                    next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'multi', value: vals, choices: f.choices });
                                                  }
                                                  return next;
                                                });
                                              }}
                                              color={isSelected ? 'primary' : 'default'}
                                              variant={isSelected ? 'filled' : 'outlined'}
                                              size="small"
                                            />
                                          );
                                        })}
                                    </FormGroup>
                                  </Box>
                                ) : (
                                  // Default: Has / No presence toggle for any custom field without explicit choices
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <ToggleButtonGroup value={existing.value === true ? 'has' : existing.value === false ? 'no' : null} exclusive size="small">
                                      <StyledToggleButton
                                        value="has"
                                        onClick={() => {
                                          setCustomFilters(prev => {
                                            const next = prev.filter((p: any) => p.fieldId !== saveFieldId);
                                            if (existing.value !== true) {
                                              next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'hasField', value: true });
                                            }
                                            return next;
                                          });
                                        }}
                                      >
                                        Has
                                      </StyledToggleButton>
                                      <StyledToggleButton
                                        value="no"
                                        onClick={() => {
                                          setCustomFilters(prev => {
                                            const next = prev.filter((p: any) => p.fieldId !== saveFieldId);
                                            if (existing.value !== false) {
                                              next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'hasField', value: false });
                                            }
                                            return next;
                                          });
                                        }}
                                      >
                                        No
                                      </StyledToggleButton>
                                    </ToggleButtonGroup>
                                  </Box>
                                )}
                              </Paper>
                            );
                          } catch (e) {
                            return null;
                          }
                        })}
                      </Stack>
                    );
                  })()
                )}
              </Box>
            </Collapse>
          </FilterSection>
        </Stack>
      </DialogContent>

      <DialogActions 
          sx={{ 
          p: 3, 
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1,
          bgcolor: alpha(theme.palette.background.paper, 0.9),
        }}
      >
        <Button
          variant="outlined"
          color="error"
          onClick={handleClearAll}
          startIcon={<ClearIcon />}
          fullWidth={isMobile}
          sx={{ borderRadius: 2 }}
        >
          Clear All
        </Button>
        <Button
          variant="outlined"
          onClick={handleRevert}
          startIcon={<RefreshIcon />}
          fullWidth={isMobile}
          sx={{ borderRadius: 2 }}
        >
          Revert
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          startIcon={<SaveIcon />}
          fullWidth={isMobile}
          sx={{ 
            borderRadius: 2,
            background: `linear-gradient(135deg, ${brandMain}, ${(theme.palette as any).brand?.dark ?? theme.palette.primary.dark})`,
          }}
        >
          Save Filters
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomFilterModal;