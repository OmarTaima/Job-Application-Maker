// types/applicants.ts - Update the TableState types
import type { 
  MRT_ColumnFiltersState, 
  MRT_RowSelectionState,
  MRT_SortingState,
  MRT_PaginationState
} from 'material-react-table';

// ============ Core Types ============
export type Interview = {
  _id?: string;
  issuedBy?: string;
  scheduledAt?: string;
  videoLink?: string;
  notes?: string;
  interviewers?: string[];
  type?: string;
  notifications?: {
    channels: {
      email: boolean;
      sms: boolean;
      whatsapp: boolean;
    };
    emailOption?: "company" | "user" | "custom";
    customEmail?: string;
    phoneOption?: "company" | "user" | "whatsapp" | "custom";
    customPhone?: string;
  };
};

export type InterviewAnswer = {
  question: string;
  score: number;
  achievedScore?: number;
  notes?: string | null;
  answerType?: string;
  choices?: string[];
};

export type Message = {
  _id?: string;
  type: "email" | "sms" | "internal" | "whatsapp";
  content: string;
  sentAt?: string;
  sentBy?: string;
  subject?: string;
};

export type Comment = {
  _id?: string;
  changedBy: string;
  changedAt: string;
  comment: string;
  text?: string;
  author?: string;
};

export type StatusHistory = {
  _id?: string;
  status: string;
  changedBy: string;
  changedAt: string;
  notes?: string;
  reasons?: string[];
  notifications?: {
    channels: {
      email: boolean;
      sms: boolean;
      whatsapp: boolean;
    };
    emailOption?: "company" | "user" | "custom";
    customEmail?: string;
    phoneOption?: "company" | "user" | "whatsapp" | "custom";
    customPhone?: string;
  };
};

export type Applicant = {
  _id: string;
  companyId: string;
  jobPositionId: string;
  departmentId: string;
  status: string;
  submittedAt: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  email: string;
  phone: string;
  address?: string;
  profilePhoto?: string;
  cvFilePath?: string;
  resume?: string;
  source?: string;
  customResponses?: Record<string, any>;
  interviews?: Interview[];
  messages?: Message[];
  comments?: Comment[];
  statusHistory?: StatusHistory[];
  createdAt?: string;
  updatedAt?: string;
  applicantNo?: number | string;
  applicantNumber?: number | string;
  no?: number | string;
  number?: number | string;
  jobPosition?: any;
  company?: any;
  companyObj?: any;
  seenBy?: string[];
  id?: string;
  name?: string;
};

// ============ Request Types ============
export type CreateApplicantRequest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender?: string;
  jobPositionId: string;
  companyId: string;
  departmentId: string;
  resume?: string;
  source?: string;
  address?: string;
  customResponses?: Record<string, any>;
};

export type UpdateApplicantRequest = {
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: string;
  phone?: string;
  address?: string;
  resume?: string;
  customResponses?: Record<string, any>;
};

export type UpdateStatusRequest = {
  status: string;
  notes?: string;
  notifications?: {
    channels: {
      email: boolean;
      sms: boolean;
      whatsapp: boolean;
    };
    emailOption?: "company" | "user" | "custom";
    customEmail?: string;
    phoneOption?: "company" | "user" | "whatsapp" | "custom";
    customPhone?: string;
  };
  reasons?: string[];
};

export type ScheduleInterviewRequest = {
  scheduledAt?: string;
  conductedBy?: string;
  scheduledBy?: string;
  description?: string | null;
  location?: string | null;
  videoLink?: string;
  address?: string | null;
  type?: string | null;
  notes?: string;
  interviewers?: string[];
  status?: "scheduled" | "in_progress" | "completed" | "cancelled";
  questions?: InterviewAnswer[];
};

export type BulkScheduleInterviewItem = ScheduleInterviewRequest & {
  applicantId: string;
};

export type BulkScheduleInterviewRequest = {
  interviews: BulkScheduleInterviewItem[];
};

export type UpdateInterviewStatusRequest = {
  scheduledAt?: string;
  scheduledBy?: string;
  startedAt?: string;
  endedAt?: string;
  conductedBy?: string;
  description?: string | null;
  location?: string | null;
  videoLink?: string;
  address?: string | null;
  type?: string | null;
  notes?: string | null;
  status?: "scheduled" | "in_progress" | "completed" | "cancelled";
  questions?: InterviewAnswer[];
};

export type AddCommentRequest = {
  comment?: string;
  text?: string;
  author?: string;
};

export type SendMessageRequest = {
  subject?: string;
  content?: string;
  comment?: string;
  type?: "email" | "sms" | "internal" | "whatsapp";
};

// ============ Hook-Specific Types ============
export type SelectedApplicantRecipient = {
  email: string;
  applicant: string | undefined;
  jobPositionId: string | undefined;
  applicantName: string;
};

export type SelectedApplicantForInterview = {
  applicantId: string;
  applicantName: string;
  applicantNo: number | null;
  email: string;
  companyId: string;
  jobPositionId?: string;
  status: string;
};

export type BulkStatusForm = {
  status?: string;
  reasons?: string[];
  notes?: string;
};

export type BulkInterviewForm = {
  date: string;
  time: string;
  description: string;
  comment: string;
  location: string;
  link: string;
  type: 'phone' | 'video' | 'in-person';
};

export type BulkNotificationChannels = {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
};

export type TableState = {
  rowSelection: Record<string, boolean>;
  columnFilters: any[];
  sorting: Array<{ id: string; desc: boolean }>;
  pagination: { pageIndex: number; pageSize: number };
  customFilters: any[];
};

// ============ API Response Types ============
export type ApiMailResponse = {
  message: string;
  page: string;
  PageCount: number | null;
  TotalCount: number;
  data: Array<{ _id: string; applicant: string | null; [key: string]: any }>;
};

// ============ API Error ============
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}
// types/applicants.ts - Add these types

// Add to existing types/applicants.ts:

export interface UseApplicantFiltersProps {
  applicants: Applicant[];
  columnFilters: any[];
  customFilters: any[];
  isSuperAdmin: boolean;
  effectiveOnlyStatus?: string | string[];
  selectedCompanyFilterValue?: string[] | string | null;
  jobPositionMap: Record<string, any>;
  fieldToJobIds: Map<string, Set<string>> | Record<string, Set<string>>;
  currentUserId: string;
  allCompaniesRaw: any[];
}

export interface UseApplicantFiltersReturn {
  filteredApplicants: Applicant[];
  duplicatesOnlyEnabled: boolean;
  displayedApplicants: Applicant[];
  statusFilterOptions: Array<{ id: string; title: string }>;
  getStatusColor: (status: string) => { bg: string; color: string };
  getDescription: (status: string) => string;
  selectedCompanyFilter: string[] | null;
}

// Add to types/applicants.ts

export interface UseBulkActionsProps {
  selectedApplicantIds: string[];
  selectedApplicantsForInterview: SelectedApplicantForInterview[];
  selectedApplicantCompanyId: string | null;
  selectedApplicantCompany: any | null;
  refetchApplicants: () => void;
  queryClient: any;
  onClearSelection?: () => void;
}

export interface UseBulkActionsReturn {
  isDeleting: boolean;
  isProcessing: boolean;
  isSubmittingBulkInterview: boolean;
  isSubmittingBulkStatus: boolean;
  showBulkModal: boolean;
  showBulkInterviewModal: boolean;
  showBulkInterviewPreviewModal: boolean;
  showBulkStatusModal: boolean;
  showBulkPreviewFallbackModal: boolean;
  bulkFormResetKey: number;
  bulkInterviewError: string;
  bulkStatusError: string;
  bulkDeleteError: string;
  bulkInterviewIntervalMinutes: number;
  bulkInterviewForm: BulkInterviewForm;
  bulkNotificationChannels: BulkNotificationChannels;
  bulkEmailOption: 'company' | 'new';
  bulkCustomEmail: string;
  bulkPhoneOption: 'company' | 'user' | 'whatsapp' | 'custom';
  bulkCustomPhone: string;
  bulkMessageTemplate: string;
  bulkInterviewEmailSubject: string;
  bulkPreviewHtml: string;
  bulkInterviewPreviewItems: any[];
  bulkStatusForm: BulkStatusForm;
  bulkAction: string;
  setShowBulkModal: (show: boolean) => void;
  setShowBulkInterviewModal: (show: boolean) => void;
  setShowBulkInterviewPreviewModal: (show: boolean) => void;
  setShowBulkStatusModal: (show: boolean) => void;
  setShowBulkPreviewFallbackModal: (show: boolean) => void;
  setBulkInterviewError: (error: string) => void;
  setBulkStatusError: (error: string) => void;
  setBulkDeleteError: (error: string) => void;
  setBulkInterviewIntervalMinutes: (minutes: number) => void;
  setBulkInterviewForm: (form: BulkInterviewForm | ((prev: BulkInterviewForm) => BulkInterviewForm)) => void;
  setBulkNotificationChannels: (channels: BulkNotificationChannels | ((prev: BulkNotificationChannels) => BulkNotificationChannels)) => void;
  setBulkEmailOption: (option: 'company' | 'new') => void;
  setBulkCustomEmail: (email: string) => void;
  setBulkPhoneOption: (option: 'company' | 'user' | 'whatsapp' | 'custom') => void;
  setBulkCustomPhone: (phone: string) => void;
  setBulkMessageTemplate: (template: string) => void;
  setBulkInterviewEmailSubject: (subject: string) => void;
  setBulkPreviewHtml: (html: string) => void;
  setBulkInterviewPreviewItems: (items: any[]) => void;
  setBulkStatusForm: (form: BulkStatusForm | ((prev: BulkStatusForm) => BulkStatusForm)) => void;
  setBulkAction: (action: string) => void;
  setIsProcessing: (processing: boolean) => void;
  handleBulkDelete: () => Promise<void>;
  handleBulkStatusChange: (e: React.FormEvent) => Promise<void>;
  handleBulkInterviewSubmit: (e: React.FormEvent) => Promise<void>;
  handlePreviewBulkInterviews: () => void;
  handleBulkChangeStatus: (action: string) => Promise<void>;
  openBulkInterviewModal: () => Promise<void>;
  resetBulkInterviewModal: () => void;
  fillBulkCompanyAddress: () => boolean;
  getSelectedCompanyAddress: () => string;
}
// Add to types/applicants.ts



export interface UseTableStateProps {
  onlyStatus?: string | string[];
  showCompanyColumn: boolean;
  jobPositionMap?: Record<string, any>;
  genderOptions: Array<{ id: string; title: string }>;
  persistedState?: any;
}

export interface UseTableStateReturn {
  rowSelection: MRT_RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<MRT_RowSelectionState>>;
  columnFilters: MRT_ColumnFiltersState;
  setColumnFilters: React.Dispatch<React.SetStateAction<MRT_ColumnFiltersState>>;
  sorting: MRT_SortingState;
  setSorting: React.Dispatch<React.SetStateAction<MRT_SortingState>>;
  pagination: MRT_PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<MRT_PaginationState>>;
  customFilters: any[];
  setCustomFilters: React.Dispatch<React.SetStateAction<any[]>>;
  initialColumnFilters: MRT_ColumnFiltersState;
  selectedApplicantIds: string[];
  persistTableState: () => void;
  clearPersistedState: () => void;
  resetToDefault: () => void;
}