export type UUID = string;

export type UserRole = "OWNER" | "ADMIN" | "SUPERVISOR" | "MEMBER" | "BILLING" | "VIEWER";

export interface User {
  id: UUID;
  email: string;
  name: string;
  avatarUrl?: string;
  phone?: string;
  createdAt: string;
}

export interface Business {
  id: UUID;
  name: string;
  logoUrl?: string;
  industry?: string;
  country?: string;
  status: "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED";
  createdAt: string;
}

export interface Workspace {
  id: UUID;
  businessId: UUID;
  name: string;
  slug: string;
  timezone: string;
  memberCount: number;
  archived?: boolean;
  description?: string;
  currency?: string;
  slaDefaults?: { low: number; medium: number; high: number; urgent: number };
  brandingColor?: string;
  logoUrl?: string;
  categories?: string[];
  createdAt: string;
}

export interface Member {
  id: UUID;
  userId: UUID;
  workspaceId: UUID;
  name: string;
  email: string;
  role: UserRole;
  status: "ACTIVE" | "INVITED" | "SUSPENDED";
  joinedAt: string;
}

export type JobStatus = "DRAFT" | "PUBLISHED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ARCHIVED";

export interface Job {
  id: UUID;
  workspaceId: UUID;
  title: string;
  description: string;
  status: JobStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  slaMinutes: number;
  taskCount: number;
  completedTaskCount: number;
  rateType?: "PER_TASK" | "PER_MINUTE" | "PER_OUTCOME";
  rateAmount?: number;
  costEstimate?: number;
  slaStatus?: "ON_TRACK" | "AT_RISK" | "BREACHED";
  tags?: string[];
  isTemplate?: boolean;
  recurring?: { cron?: string; startDate?: string; endDate?: string };
  createdAt: string;
  startAt?: string;
  dueAt?: string;
}

export type TaskStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface Task {
  id: UUID;
  jobId?: UUID;
  jobTitle?: string;
  businessId?: UUID;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assignedAgentId?: UUID;
  assignedAgentName?: string;
  skill?: string;
  slaMinutes: number;
  failedReason?: string;
  qaScore?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  dueAt?: string;
}

export interface Agent {
  id: UUID;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  status: "ONLINE" | "BUSY" | "OFFLINE";
  skills: string[];
  rating: number;
  completedTasks: number;
  activeTasks: number;
  successRate: number;
  favorite?: boolean;
  blocked?: boolean;
  avgHandleTimeMinutes?: number;
}

export interface Wallet {
  id: UUID;
  workspaceId: UUID;
  currency: string;
  balance: number;
  reservedBalance: number;
  autoRechargeEnabled?: boolean;
  autoRechargeThreshold?: number;
  autoRechargeAmount?: number;
  updatedAt: string;
}

export interface WalletTransaction {
  id: UUID;
  walletId: UUID;
  type: "CREDIT" | "DEBIT";
  amount: number;
  currency: string;
  description: string;
  reference?: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  createdAt: string;
}

export interface Invoice {
  id: UUID;
  number: string;
  workspaceId: UUID;
  amount: number;
  currency: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
}

export interface Plan {
  id: UUID;
  name: string;
  price: number;
  currency: string;
  interval: "MONTH" | "YEAR";
  taskQuota: number;
  features: string[];
}

export interface PaymentMethod {
  id: UUID;
  type: "CARD" | "MPESA" | "BANK";
  label: string;
  last4?: string;
  brand?: string;
  phone?: string;
  isDefault?: boolean;
}

export interface ActivityEvent {
  id: UUID;
  taskId?: UUID;
  jobId?: UUID;
  actorName: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface ChatMessage {
  id: UUID;
  taskId?: UUID;
  conversationId?: UUID;
  senderId: UUID;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface Conversation {
  id: UUID;
  title: string;
  type?: "DIRECT" | "GROUP";
  taskId?: UUID;
  participants: { id: UUID; name: string; role?: string }[];
  lastMessage?: string;
  lastMessageAt?: string;
  unread: number;
}

export interface Notification {
  id: UUID;
  type: string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface Shift {
  id: UUID;
  workspaceId: UUID;
  agentId: UUID;
  agentName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  role?: string;
}

export interface QaReview {
  id: UUID;
  taskId: UUID;
  taskTitle?: string;
  agentId: UUID;
  agentName: string;
  reviewerName: string;
  score: number;
  feedback?: string;
  createdAt: string;
}

export interface Escalation {
  id: UUID;
  jobId?: UUID;
  taskId?: UUID;
  subject: string;
  reason: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  raisedBy: string;
  assignedTo?: string;
  createdAt: string;
}

export interface CallSession {
  id: UUID;
  conversationId?: UUID;
  initiatorId: string;
  type: "VOICE" | "VIDEO";
  status: "INITIATED" | "RINGING" | "ONGOING" | "COMPLETED" | "MISSED" | "FAILED";
  startedAt?: string;
  endedAt?: string;
  scheduledAt?: string;
  durationSec?: number;
  recordingUrl?: string;
  meetingUrl?: string;
  roomName?: string;
  meetingTitle?: string;
  participantIds?: string;
  recurrenceRule?: string;
  recurrenceParentId?: string;
  meetingPassword?: string;
  createdAt: string;
}

export interface ApiKey {
  id: UUID;
  label: string;
  prefix: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface Webhook {
  id: UUID;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: UUID;
  subject: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  timestamp: string;
  message?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type SubmissionRound = 'FIRST_DRAFT' | 'SECOND_DRAFT' | 'FINAL';
export type SubmissionType = 'FILE' | 'LINK' | 'TEXT' | 'OTHER';
export type SubmissionStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED';

export interface TaskSubmission {
  id: UUID;
  taskId: UUID;
  agentId: UUID;
  agentName?: string;
  round: SubmissionRound;
  type: SubmissionType;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  notes?: string;
  status: SubmissionStatus;
  reviewNote?: string;
  submittedAt: string;
  reviewedAt?: string;
}
