// types/applicants.ts

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
};

export type CreateApplicantRequest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
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