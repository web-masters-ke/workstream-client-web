import type { Agent, Invoice, Job, Member, Plan, Task, Wallet, WalletTransaction, Workspace, ActivityEvent, ChatMessage, Notification, Shift, QaReview, Escalation, Conversation, CallSession, PaymentMethod, ApiKey, Webhook, SupportTicket } from "./types";

export const mockWorkspaces: Workspace[] = [
  { id: "ws-1", businessId: "biz-1", name: "Acme Support", slug: "acme-support", timezone: "UTC", memberCount: 8, createdAt: "2026-01-12T10:00:00Z", slaDefaults: { low: 480, medium: 240, high: 60, urgent: 15 }, brandingColor: "#6366f1", categories: ["Support", "KYC", "Voice"] },
  { id: "ws-2", businessId: "biz-1", name: "Acme Sales Ops", slug: "acme-sales", timezone: "UTC", memberCount: 4, createdAt: "2026-02-02T10:00:00Z", categories: ["Calls", "Renewals"] },
];

export const mockMembers: Member[] = [
  { id: "m-1", userId: "u-1", workspaceId: "ws-1", name: "Jane Owner", email: "jane@acme.com", role: "OWNER", status: "ACTIVE", joinedAt: "2026-01-12" },
  { id: "m-2", userId: "u-2", workspaceId: "ws-1", name: "Mark Supervisor", email: "mark@acme.com", role: "SUPERVISOR", status: "ACTIVE", joinedAt: "2026-01-20" },
  { id: "m-3", userId: "u-3", workspaceId: "ws-1", name: "Sara Admin", email: "sara@acme.com", role: "ADMIN", status: "ACTIVE", joinedAt: "2026-02-01" },
  { id: "m-4", userId: "u-4", workspaceId: "ws-1", name: "Tom Viewer", email: "tom@acme.com", role: "VIEWER", status: "ACTIVE", joinedAt: "2026-03-01" },
  { id: "m-5", userId: "u-5", workspaceId: "ws-1", name: "Fin Billing", email: "fin@acme.com", role: "BILLING", status: "ACTIVE", joinedAt: "2026-03-05" },
  { id: "m-6", userId: "u-6", workspaceId: "ws-1", name: "Invited User", email: "new@acme.com", role: "MEMBER", status: "INVITED", joinedAt: "2026-04-10" },
];

export const mockJobs: Job[] = [
  { id: "job-1", workspaceId: "ws-1", title: "Customer onboarding batch #204", description: "Onboard 40 new customers via KYC review and initial call.", status: "IN_PROGRESS", priority: "HIGH", slaMinutes: 240, taskCount: 40, completedTaskCount: 18, rateType: "PER_TASK", rateAmount: 1.5, costEstimate: 60, slaStatus: "AT_RISK", tags: ["KYC", "onboarding"], createdAt: "2026-04-10T09:00:00Z", dueAt: "2026-04-15T17:00:00Z" },
  { id: "job-2", workspaceId: "ws-1", title: "Ticket triage — weekend backlog", description: "Classify and respond to 120 overnight support tickets.", status: "PUBLISHED", priority: "MEDIUM", slaMinutes: 60, taskCount: 120, completedTaskCount: 0, rateType: "PER_OUTCOME", rateAmount: 0.75, costEstimate: 90, slaStatus: "ON_TRACK", tags: ["tickets"], createdAt: "2026-04-12T06:00:00Z" },
  { id: "job-3", workspaceId: "ws-1", title: "Outbound call campaign — Q2 renewal", description: "Call 85 accounts renewing this quarter.", status: "DRAFT", priority: "LOW", slaMinutes: 480, taskCount: 85, completedTaskCount: 0, rateType: "PER_MINUTE", rateAmount: 0.25, costEstimate: 320, slaStatus: "ON_TRACK", tags: ["calls", "renewal"], createdAt: "2026-04-11T14:30:00Z" },
  { id: "job-4", workspaceId: "ws-1", title: "Dispute triage", description: "Review 12 open customer disputes.", status: "IN_PROGRESS", priority: "URGENT", slaMinutes: 30, taskCount: 12, completedTaskCount: 8, slaStatus: "BREACHED", createdAt: "2026-04-13T07:00:00Z", dueAt: "2026-04-13T12:00:00Z" },
];

export const mockTasks: Task[] = [
  { id: "t-1", jobId: "job-1", jobTitle: "Onboarding #204", title: "KYC review — Customer 1042", status: "IN_PROGRESS", priority: "HIGH", assignedAgentId: "a-1", assignedAgentName: "Alex Karanja", skill: "KYC", slaMinutes: 60, createdAt: "2026-04-12T10:00:00Z", startedAt: "2026-04-13T08:30:00Z", dueAt: "2026-04-13T14:00:00Z" },
  { id: "t-2", jobId: "job-1", jobTitle: "Onboarding #204", title: "Welcome call — Customer 1043", status: "ASSIGNED", priority: "MEDIUM", assignedAgentId: "a-2", assignedAgentName: "Brenda Owino", skill: "Voice", slaMinutes: 30, createdAt: "2026-04-12T10:00:00Z" },
  { id: "t-3", jobId: "job-2", jobTitle: "Ticket triage", title: "Ticket #8824 — password reset", status: "PENDING", priority: "LOW", skill: "Support", slaMinutes: 30, createdAt: "2026-04-13T05:30:00Z" },
  { id: "t-4", jobId: "job-1", jobTitle: "Onboarding #204", title: "KYC review — Customer 1041", status: "COMPLETED", priority: "HIGH", assignedAgentId: "a-1", assignedAgentName: "Alex Karanja", skill: "KYC", slaMinutes: 60, qaScore: 92, createdAt: "2026-04-11T10:00:00Z", startedAt: "2026-04-11T10:30:00Z", completedAt: "2026-04-11T11:10:00Z" },
  { id: "t-5", jobId: "job-2", jobTitle: "Ticket triage", title: "Ticket #8801 — refund inquiry", status: "FAILED", priority: "MEDIUM", skill: "Support", slaMinutes: 30, failedReason: "Customer unresponsive", createdAt: "2026-04-12T05:30:00Z" },
  { id: "t-6", jobId: "job-4", jobTitle: "Dispute triage", title: "Dispute #D-118 — duplicate charge", status: "IN_PROGRESS", priority: "URGENT", assignedAgentId: "a-4", assignedAgentName: "Diana Mwangi", skill: "Tier-2 Support", slaMinutes: 30, createdAt: "2026-04-13T07:10:00Z", startedAt: "2026-04-13T07:20:00Z" },
];

export const mockAgents: Agent[] = [
  { id: "a-1", name: "Alex Karanja", email: "alex@agents.ws", phone: "+254700000001", status: "ONLINE", skills: ["KYC", "English"], rating: 4.8, completedTasks: 1240, activeTasks: 2, successRate: 0.97, favorite: true, avgHandleTimeMinutes: 18 },
  { id: "a-2", name: "Brenda Owino", email: "brenda@agents.ws", status: "BUSY", skills: ["Voice", "Swahili"], rating: 4.6, completedTasks: 980, activeTasks: 3, successRate: 0.94, avgHandleTimeMinutes: 22 },
  { id: "a-3", name: "Chris Ndegwa", email: "chris@agents.ws", status: "OFFLINE", skills: ["Data entry"], rating: 4.2, completedTasks: 410, activeTasks: 0, successRate: 0.91, avgHandleTimeMinutes: 14 },
  { id: "a-4", name: "Diana Mwangi", email: "diana@agents.ws", status: "ONLINE", skills: ["Tier-2 Support"], rating: 4.9, completedTasks: 2010, activeTasks: 1, successRate: 0.98, favorite: true, avgHandleTimeMinutes: 12 },
  { id: "a-5", name: "Evan Kipchumba", email: "evan@agents.ws", status: "ONLINE", skills: ["KYC", "Voice"], rating: 4.4, completedTasks: 620, activeTasks: 2, successRate: 0.93, avgHandleTimeMinutes: 20 },
];

export const mockWallet: Wallet = {
  id: "w-1", workspaceId: "ws-1", currency: "USD", balance: 4820.50, reservedBalance: 310.00, autoRechargeEnabled: true, autoRechargeThreshold: 500, autoRechargeAmount: 1000, updatedAt: "2026-04-13T10:00:00Z",
};

export const mockWalletTransactions: WalletTransaction[] = [
  { id: "wt-1", walletId: "w-1", type: "CREDIT", amount: 2000, currency: "USD", description: "Top-up via card", status: "COMPLETED", createdAt: "2026-04-10T12:00:00Z" },
  { id: "wt-2", walletId: "w-1", type: "DEBIT", amount: 45.5, currency: "USD", description: "Task #t-4 payout", status: "COMPLETED", createdAt: "2026-04-11T11:20:00Z" },
  { id: "wt-3", walletId: "w-1", type: "DEBIT", amount: 120, currency: "USD", description: "Batch #204 reservation", status: "PENDING", createdAt: "2026-04-12T09:00:00Z" },
  { id: "wt-4", walletId: "w-1", type: "CREDIT", amount: 500, currency: "USD", description: "M-Pesa top-up", status: "COMPLETED", createdAt: "2026-04-12T16:00:00Z" },
];

export const mockInvoices: Invoice[] = [
  { id: "inv-1", number: "INV-2026-0041", workspaceId: "ws-1", amount: 1250, currency: "USD", status: "PAID", issuedAt: "2026-03-01", dueAt: "2026-03-15", paidAt: "2026-03-10" },
  { id: "inv-2", number: "INV-2026-0052", workspaceId: "ws-1", amount: 980, currency: "USD", status: "SENT", issuedAt: "2026-04-01", dueAt: "2026-04-15" },
];

export const mockPlans: Plan[] = [
  { id: "p-1", name: "Starter", price: 99, currency: "USD", interval: "MONTH", taskQuota: 500, features: ["Up to 5 seats", "500 tasks/mo", "Email support"] },
  { id: "p-2", name: "Growth", price: 299, currency: "USD", interval: "MONTH", taskQuota: 2500, features: ["Up to 25 seats", "2,500 tasks/mo", "Priority support", "SLA reports"] },
  { id: "p-3", name: "Scale", price: 799, currency: "USD", interval: "MONTH", taskQuota: 10000, features: ["Unlimited seats", "10,000 tasks/mo", "Dedicated CSM", "Custom integrations"] },
];

export const mockPaymentMethods: PaymentMethod[] = [
  { id: "pm-1", type: "CARD", label: "Visa ending 4242", last4: "4242", brand: "Visa", isDefault: true },
  { id: "pm-2", type: "MPESA", label: "M-Pesa +254 712", phone: "+254712000000" },
];

export const mockActivity: ActivityEvent[] = [
  { id: "e-1", taskId: "t-1", actorName: "Alex Karanja", type: "STATUS_CHANGE", message: "moved to In Progress", createdAt: "2026-04-13T08:30:00Z" },
  { id: "e-2", taskId: "t-1", actorName: "Mark Supervisor", type: "ASSIGNED", message: "assigned to Alex Karanja", createdAt: "2026-04-13T08:10:00Z" },
  { id: "e-3", taskId: "t-1", actorName: "System", type: "CREATED", message: "task created from Job #204", createdAt: "2026-04-12T10:00:00Z" },
];

export const mockMessages: ChatMessage[] = [
  { id: "msg-1", taskId: "t-1", senderId: "u-2", senderName: "Mark Supervisor", body: "Any blockers on this KYC?", createdAt: "2026-04-13T08:35:00Z" },
  { id: "msg-2", taskId: "t-1", senderId: "a-1", senderName: "Alex Karanja", body: "Waiting on utility bill upload — pinged the customer.", createdAt: "2026-04-13T08:40:00Z" },
];

export const mockConversations: Conversation[] = [
  { id: "c-1", title: "Onboarding #204 — KYC 1042", taskId: "t-1", participants: [{ id: "u-2", name: "Mark Supervisor", role: "SUPERVISOR" }, { id: "a-1", name: "Alex Karanja", role: "AGENT" }], lastMessage: "Waiting on utility bill upload…", lastMessageAt: "2026-04-13T08:40:00Z", unread: 2 },
  { id: "c-2", title: "Ticket #8824", taskId: "t-3", participants: [{ id: "u-2", name: "Mark Supervisor" }, { id: "a-2", name: "Brenda Owino" }], lastMessage: "Customer confirmed reset.", lastMessageAt: "2026-04-13T07:10:00Z", unread: 0 },
  { id: "c-3", title: "Dispute D-118", taskId: "t-6", participants: [{ id: "u-3", name: "Sara Admin" }, { id: "a-4", name: "Diana Mwangi" }], lastMessage: "Escalating to finance.", lastMessageAt: "2026-04-13T09:20:00Z", unread: 1 },
];

export const mockNotifications: Notification[] = [
  { id: "n-1", type: "SLA_BREACH", title: "SLA breached on Task t-5", body: "Ticket #8801 passed its 30m SLA.", link: "/tasks/t-5", read: false, createdAt: "2026-04-13T09:45:00Z" },
  { id: "n-2", type: "NEW_MESSAGE", title: "New message from Alex Karanja", body: "Waiting on utility bill upload…", link: "/tasks/t-1", read: false, createdAt: "2026-04-13T08:41:00Z" },
  { id: "n-3", type: "JOB_COMPLETE", title: "Job 'Dispute triage' 75% done", link: "/jobs/job-4", read: true, createdAt: "2026-04-13T07:30:00Z" },
];

export const mockShifts: Shift[] = [
  { id: "sh-1", workspaceId: "ws-1", agentId: "a-1", agentName: "Alex Karanja", date: "2026-04-13", startTime: "08:00", endTime: "16:00", role: "KYC" },
  { id: "sh-2", workspaceId: "ws-1", agentId: "a-2", agentName: "Brenda Owino", date: "2026-04-13", startTime: "09:00", endTime: "17:00", role: "Voice" },
  { id: "sh-3", workspaceId: "ws-1", agentId: "a-4", agentName: "Diana Mwangi", date: "2026-04-14", startTime: "08:00", endTime: "14:00", role: "Tier-2" },
];

export const mockQaReviews: QaReview[] = [
  { id: "qa-1", taskId: "t-4", taskTitle: "KYC review — 1041", agentId: "a-1", agentName: "Alex Karanja", reviewerName: "Mark Supervisor", score: 92, feedback: "Accurate, polite. Minor: missed phone verification step.", createdAt: "2026-04-11T12:00:00Z" },
  { id: "qa-2", taskId: "t-1", taskTitle: "KYC review — 1042", agentId: "a-1", agentName: "Alex Karanja", reviewerName: "Sara Admin", score: 85, createdAt: "2026-04-13T10:00:00Z" },
];

export const mockEscalations: Escalation[] = [
  { id: "esc-1", taskId: "t-5", subject: "Ticket #8801 — refund dispute", reason: "Customer threatening chargeback", priority: "HIGH", status: "OPEN", raisedBy: "Brenda Owino", createdAt: "2026-04-12T08:00:00Z" },
  { id: "esc-2", jobId: "job-4", subject: "Dispute triage SLA breach", reason: "4 tasks breached 30m SLA", priority: "URGENT", status: "IN_REVIEW", raisedBy: "System", assignedTo: "Mark Supervisor", createdAt: "2026-04-13T09:50:00Z" },
];

export const mockCalls: CallSession[] = [
  { id: "call-1", taskId: "t-2", participants: ["Brenda Owino", "Customer 1043"], direction: "OUTBOUND", durationSeconds: 312, status: "COMPLETED", startedAt: "2026-04-13T09:00:00Z" },
  { id: "call-2", taskId: "t-6", participants: ["Diana Mwangi", "Customer D-118"], direction: "OUTBOUND", durationSeconds: 0, status: "MISSED", startedAt: "2026-04-13T09:30:00Z" },
];

export const mockApiKeys: ApiKey[] = [
  { id: "ak-1", label: "Production", prefix: "wsp_live_7a2b", lastUsedAt: "2026-04-13T09:00:00Z", createdAt: "2026-02-01T10:00:00Z" },
  { id: "ak-2", label: "Staging", prefix: "wsp_test_91de", createdAt: "2026-03-12T10:00:00Z" },
];

export const mockWebhooks: Webhook[] = [
  { id: "wh-1", url: "https://hooks.acme.com/ws/task-events", events: ["task.completed", "task.failed", "sla.breached"], active: true, createdAt: "2026-03-01T10:00:00Z" },
];

export const mockTickets: SupportTicket[] = [
  { id: "tk-1", subject: "Unable to invite agent", status: "IN_REVIEW", priority: "MEDIUM", createdAt: "2026-04-12T10:00:00Z" },
  { id: "tk-2", subject: "Wallet top-up failing", status: "OPEN", priority: "HIGH", createdAt: "2026-04-13T08:00:00Z" },
];
