/**
 * Typed API client for the Victora backend (Cloudflare Worker + VictoraDB).
 * Session auth rides on an HttpOnly cookie — credentials: "include" always.
 */

const BASE: string = (import.meta.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL as string | undefined) ?? "";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Role = "client" | "agent" | "manager" | "compliance" | "super_admin";

export type AuthUser = { id: string; email: string; name: string; role: Role; phone: string };

export type ClientProfile = {
  id: string;
  user_id: string | null;
  household_id: string;
  agent_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  journey_stage: string;
  source: string;
  campaign: string;
  preferred_language?: string;
  created_at: number;
  updated_at: number;
};

export type TimelineEvent = { id: string; at: number; actor: string; kind: string; label: string };

export type AppointmentRow = {
  id: string;
  client_id: string | null;
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  topic: string;
  channel: string;
  notes: string;
  created_at: number;
};

export type LeadRow = {
  id: string;
  client_id: string | null;
  name: string;
  email: string;
  phone: string;
  source: string;
  campaign: string;
  coverage_type: string;
  zip: string;
  details: string;
  stage: string;
  assigned_agent: string | null;
  created_at: number;
};

export type ClientListItem = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  journey_stage: string;
  source: string;
  campaign: string;
  agent_id: string | null;
  agent_name: string | null;
  is_test?: number;
  created_at: number;
};

export type IntakeRow = { id: string; area: string; payload: string; status: string; created_at: number; reviewed_by: string | null };

export type DocumentRequestRow = {
  id: string;
  requested_by?: string;
  category: string;
  document_type: string;
  instructions: string;
  due_date: string;
  required: number;
  status: string;
  created_at: number;
};

export type DocumentRow = {
  id: string;
  request_id: string | null;
  document_type: string;
  category: string;
  original_filename: string;
  mime_type: string;
  size: number;
  status: string;
  review_note?: string;
  rejection_reason?: string;
  uploaded_at: number;
  reviewed_at: number | null;
  reviewed_by?: string | null;
};

export type AuthorizationRecordRow = {
  id: string;
  template_name: string;
  template_version: number;
  status: string;
  signed_text?: string;
  signer_name?: string;
  signature?: string;
  method?: string;
  signed_at: number | null;
  ip?: string;
  user_agent?: string;
  expires_at: number | null;
  revoked_at: number | null;
  created_at: number;
  agent_id?: string | null;
};

export type QuoteOptionRow = {
  id: string;
  label: string;
  carrier: string;
  plan_name: string;
  metal_tier: string;
  premium: string;
  deductible: string;
  oop_max: string;
  pcp: string;
  specialist: string;
  urgent_care: string;
  er: string;
  generic_rx: string;
  network_type: string;
  dental_note: string;
  vision_note: string;
  notes: string;
  doc_link: string;
};

export type QuotePresentationRow = {
  id: string;
  agent_id: string;
  title: string;
  coverage_area: string;
  status: string;
  sent_at: number | null;
  viewed_at: number | null;
  interested_option: string;
  created_at: number;
  options?: QuoteOptionRow[];
  first_name?: string;
  last_name?: string;
};

export type ClientQuoteRow = {
  id: string;
  title: string;
  coverage_area: string;
  status: string;
  sent_at: number | null;
  viewed_at: number | null;
  interested_option: string;
  agent_id: string;
  agent_name: string | null;
  options: QuoteOptionRow[];
};

export type TemplateRow = { id: string; template_key: string; name: string; version: number; body: string; active: number; created_at: number };

export type ClientRecord = {
  profile: ClientProfile & { agent_name: string | null; relationship_status?: string };
  agent: { id: string; name: string; email: string } | null;
  members: { id: string; name: string; dob: string; relationship: string; tobacco: number }[];
  leads: { id: string; source: string; campaign: string; coverage_type: string; stage: string; created_at: number }[];
  intakes: IntakeRow[];
  timeline: TimelineEvent[];
  appointments: AppointmentRow[];
  documentRequests: DocumentRequestRow[];
  documents: DocumentRow[];
  authorizations: AuthorizationRecordRow[];
  quotes: QuotePresentationRow[];
  audit: { at: number; actor_role: string; action: string; detail: string }[];
  /* Sprint 3 */
  tickets?: TicketRow[];
  policies?: PolicyRow[];
  renewals?: RenewalRow[];
  referrals?: ReferralRow[];
  conversations?: { id: string; subject: string; status: string; last_message_at: number | null; unread_client: number; message_count: number }[];
  internalNotes?: { id: string; author_name: string; author_role: string; body: string; created_at: number }[];
  welcome?: { item_key: string; completed_at: number }[];
  commPrefs?: CommPrefs | null;
  relationshipStatus?: string;
};

export type ClientOverview = {
  profile: ClientProfile;
  protection: { health: string | null; dental: string | null; vision: string | null };
  journeyStage: string;
  attention: { severity: "red" | "amber" | "green"; text: string }[];
  members: { id: string; name: string; dob: string; relationship: string; tobacco: number }[];
  timeline: TimelineEvent[];
  appointments: { id: string; date: string; time: string; topic: string; channel: string }[];
  agentName: string | null;
  agent?: { id: string; name: string; email: string; phone: string } | null;
  nextAppointment: { id: string; date: string; time: string; topic: string; channel: string } | null;
  unread: number;
  /* Sprint 3 */
  policies?: { id: string; product_type: string; carrier: string; plan_name: string; status: string; monthly_premium: string; effective_date: string; termination_date: string; network_type: string }[];
  openTickets?: number;
  nextRenewal?: { id: string; policy_id: string; renewal_period: string; renewal_date: string; status: string } | null;
  welcome?: { unlocked: boolean; completed: string[] };
  unreadMessages?: number;
  relationshipStatus?: string;
};

export type StaffOverview = {
  today: {
    newLeads: number;
    unassignedLeads: number;
    intakesToReview: number;
    clientsWaiting: number;
    upcomingAppointments: number;
    openTasks: number;
    activeClients: number;
    totalClients: number;
    documentsToReview: number;
    authorizationsPending: number;
    quotesAwaitingView: number;
    quotesInterested: number;
    unreadMessages: number;
    openTickets: number;
    ticketsWaitingClient: number;
    activePolicies: number;
    renewalsNext60: number;
    referralsNew: number;
    welcomeIncomplete: number;
  };
  viewer: AuthUser;
};

export type TaskRow = { id: string; title: string; detail: string; due_at: number; source: string; done: number; ref_type: string; ref_id: string; created_at: number; assigned_to?: string; client_id?: string; priority?: string };

export type NotificationRow = { id: string; at: number; title: string; body: string; read: number };

/* ------------------------------ Sprint 3 types ------------------------------ */

export type PolicyRow = {
  id: string;
  client_id?: string;
  product_type: string;
  carrier: string;
  plan_name: string;
  policy_identifier?: string;
  effective_date: string;
  termination_date?: string;
  status: string;
  monthly_premium: string;
  deductible: string;
  out_of_pocket_max: string;
  network_type: string;
  pcp_cost?: string;
  specialist_cost?: string;
  rx_summary?: string;
  carrier_portal_url: string;
  provider_search_url: string;
  carrier_phone?: string;
  notes?: string;
  first_name?: string;
  last_name?: string;
  members?: { name: string; relationship: string; dob: string }[];
  created_at?: number;
};

export type TicketRow = {
  id: string;
  ticket_number: string;
  category: string;
  description: string;
  status: string;
  priority?: string;
  latest_response: string;
  assigned_name?: string | null;
  assigned_to?: string | null;
  client_id?: string;
  first_name?: string;
  last_name?: string;
  created_at: number;
  updated_at: number;
};

export type TicketCommentRow = { id: string; author_role: string; body: string; created_at: number; internal?: number; author_name?: string };

export type RenewalRow = {
  id: string;
  policy_id?: string;
  client_id?: string;
  renewal_period: string;
  renewal_date: string;
  status: string;
  assigned_agent?: string | null;
  outcome?: string;
  notes?: string;
  product_type?: string;
  carrier?: string;
  plan_name?: string;
  first_name?: string;
  last_name?: string;
  created_at?: number;
};

export type ReferralRow = {
  id: string;
  referring_client_id?: string;
  client_id?: string;
  referred_name: string;
  referred_email: string;
  referred_phone: string;
  relationship: string;
  status: string;
  created_at: number;
  first_name?: string;
  last_name?: string;
  converted_client_id?: string | null;
  message?: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  sender_role: string;
  body: string;
  created_at: number;
  read_at: number | null;
  message_type: string;
  attachment_document_id: string | null;
  system_generated: number;
};

export type CommPrefs = {
  portal: number;
  email: number;
  sms: number;
  phone: number;
  preferred_language: string;
  consent_status: string;
  consent_at: number | null;
  optout_at: number | null;
  source: string;
  updated_at: number;
};

export type WelcomeState = {
  unlocked: boolean;
  completed: { item_key: string; completed_at: number }[];
  activePolicies: { id: string; product_type: string; carrier: string; plan_name: string; carrier_portal_url: string; provider_search_url: string; carrier_phone: string; effective_date: string }[];
  agent: { id: string; name: string; email: string; phone: string } | null;
};

export type StaffConversationRow = {
  id: string;
  subject: string;
  status: string;
  last_message_at: number | null;
  client_id: string;
  agent_id: string | null;
  first_name: string;
  last_name: string;
  last_message: string | null;
  last_sender_role: string | null;
  unread_client: number;
};

/* ------------------------------ Sprint 4 types ------------------------------ */

export type AnalyticsResponse = {
  filters: { from: string | null; to: string | null; agentId: string | null; product: string | null; source: string | null; includeTests: boolean };
  generatedAt: number;
  pipeline: Record<string, number>;
  conversion: Record<string, { numerator: number; denominator: number; percent: number | null }>;
  production: { activePolicies: number; byProduct: Record<string, number>; byCarrier: { carrier: string; n: number }[]; byAgent: { name: string; n: number }[] };
  service: { openTickets: number; avgOpenAgeHours: number; avgResolutionHours: number; unreadMessages: number; outstandingDocumentRequests: number };
  renewalsByStatus: Record<string, number>;
  marketing: { bySource: { source: string; n: number }[]; byCampaign: { campaign: string; n: number }[]; referralsByStatus: Record<string, number> };
  team: { id: string; name: string; role: string; assignedClients: number; activeClients: number; appointments: number; quotes: number; openFollowUps: number; openRenewals: number }[];
  definitions: Record<string, string>;
};

export type CommissionRecordRow = {
  id: string;
  policy_id: string | null;
  client_id: string | null;
  carrier: string;
  product: string;
  agent_id: string | null;
  agent_name: string | null;
  statement_period: string;
  commission_type: string;
  expected_amount: number;
  received_amount: number;
  status: string;
  carrier_reference: string;
  paid_date: string;
  notes: string;
  first_name?: string;
  last_name?: string;
  created_at: number;
  updated_at: number;
};

export type CommissionSummary = {
  expectedTotal: number;
  receivedTotal: number;
  outstanding: number;
  chargebacks: number;
  byCarrier: { carrier: string; expected: number; received: number; n: number }[];
  byProduct: { product: string; expected: number; received: number; n: number }[];
  byAgent: { name: string; expected: number; received: number; n: number }[];
};

export type LicenseRow = {
  id: string; agent_id: string; agent_name: string; state: string; license_number: string;
  line_of_authority: string; issue_date: string; expiration: string; status: string; notes: string;
  daysToExpiration: number | null; expired: boolean;
};

export type CarrierAppointmentRow = {
  id: string; agent_id: string; agent_name: string; carrier: string; state: string; product: string;
  effective_date: string; termination_date: string; status: string; notes: string;
};

export type CertificationRow = {
  id: string; agent_id: string; agent_name: string; certification: string; completed_date: string;
  expiration: string; documentation: string; status: string; daysToExpiration: number | null; expired: boolean;
};

export type MarketingReviewRow = {
  id: string; title: string; campaign: string; content: string; status: string;
  submitted_by: string; reviewer: string; decision_notes: string; reviewed_at: number | null; created_at: number;
};

export type ComplaintRow = {
  id: string; client_id: string | null; complaint_type: string; channel: string; details: string;
  owner_id: string | null; owner_name: string | null; status: string; resolution: string;
  received_at: number; closed_at: number | null; first_name?: string; last_name?: string;
  notes: { id: string; author_role: string; body: string; created_at: number }[];
};

export type RetentionPolicyRow = { id: string; record_type: string; retention_days: number | null; hold: number; notes: string };

export type CommTemplateRow = {
  id: string; template_key: string; channel: string; language: string; subject: string;
  body: string; version: number; active: number; created_by: string; created_at: number;
};

export type SecurityEventRow = { id: string; at: number; actor_id: string; actor_role: string; action: string; target: string; detail: string };

export type DeliveryRow = {
  id: string; user_id: string; client_id: string; event: string; channel: string; provider: string;
  destination: string; template: string; title: string; status: string; attempts: number; error: string;
  ref_type: string; ref_id: string; created_at: number; delivered_at: number | null;
};

export type SystemHealthResponse = {
  backend: { status: string; service: string };
  providers: { email: string; sms: string; calendar: string; storage: string };
  deliveries: { failed: number; notConfigured: number };
  automation: { staleTasks: { id: string; title: string; due_at: number; priority: string }[] };
  db: Record<string, number>;
  backups: { last: { at: number; kind: string; record_count: number; created_by: string } | null; automated: boolean };
  recentActivity: { at: number; actor_role: string; action: string; target: string }[];
  notes: string[];
};

export type LaunchChecklistResponse = {
  items: { key: string; category: string; label: string; status: "complete" | "incomplete"; how: "computed" | "manual"; detail: string }[];
  summary: { complete: number; total: number; ready: boolean; note: string };
};

export type LegalDocRow = { doc_key: string; version: number; title: string; body: string; effective_at: number };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      credentials: "include",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("The Victora service is unreachable right now. Please try again.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    throw new ApiError(typeof data.error === "string" ? data.error : "Request failed", res.status);
  }
  return data as T;
}

const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

/** Multipart upload — lets the browser set the Content-Type boundary. */
async function upload<T>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { method: "POST", credentials: "include", body: form });
  } catch {
    throw new ApiError("The Victora service is unreachable right now. Please try again.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    throw new ApiError(typeof data.error === "string" ? data.error : "Upload failed", res.status);
  }
  return data as T;
}

/** Authenticated file download — bytes only ever come through the API. */
async function download(path: string): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { credentials: "include" });
  } catch {
    throw new ApiError("The Victora service is unreachable right now.", 0);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(typeof data.error === "string" ? data.error : "Download failed", res.status);
  }
  return res.blob();
}

export type LeadCapture = {
  name: string;
  email: string;
  phone?: string;
  source?: string;
  campaign?: string;
  coverage_type?: string;
  zip?: string;
  details?: string;
  preferred_language?: string;
};

export type IntakePayload = {
  area: "health" | "dental" | "vision";
  householdSize?: number;
  currentlyInsured?: boolean;
  currentCarrier?: string;
  doctors?: string;
  medications?: string;
  needs?: string[];
  notes?: string;
  members?: string[];
};

export type BookingPayload = {
  name: string;
  email: string;
  phone?: string;
  date: string;
  time: string;
  topic?: string;
  channel?: string;
  notes?: string;
  source?: string;
};

export const api = {
  ping: (): Promise<{ ok: boolean }> => request("/../ping"),

  register: (body: { name: string; email: string; password: string; phone?: string; source?: string; campaign?: string }): Promise<{ user: AuthUser }> =>
    post("/auth/register", body),

  registerStaff: (body: { name: string; email: string; password: string; code: string; role?: string }): Promise<{ user: AuthUser }> =>
    post("/auth/register/staff", body),

  login: (body: { email: string; password: string }): Promise<{ user: AuthUser }> => post("/auth/login", body),

  logout: (): Promise<{ ok: boolean }> => post("/auth/logout"),

  me: (): Promise<{ user: AuthUser | null; profile?: ClientProfile | null }> => request("/auth/me"),

  captureLead: (body: LeadCapture): Promise<{ ok: boolean; leadId: string }> => post("/leads", body),

  bookAppointment: (body: BookingPayload): Promise<{ ok: boolean; appointmentId: string }> => post("/appointments", body),

  submitIntake: (body: IntakePayload): Promise<{ ok: boolean; intakeId: string }> => post("/intake", body),

  clientOverview: (): Promise<ClientOverview> => request("/me/overview"),

  notifications: (): Promise<{ notifications: NotificationRow[] }> => request("/notifications"),

  markNotificationRead: (id: string): Promise<{ ok: boolean }> => post(`/notifications/${id}/read`),

  staffOverview: (): Promise<StaffOverview> => request("/staff/overview"),

  leads: (stage?: string): Promise<{ leads: LeadRow[] }> => request(`/leads${stage ? `?stage=${encodeURIComponent(stage)}` : ""}`),

  setLeadStage: (id: string, stage: string): Promise<{ ok: boolean }> => post(`/leads/${id}/stage`, { stage }),

  assignLead: (id: string, agentId: string): Promise<{ ok: boolean }> => post(`/leads/${id}/assign`, { agentId }),

  clients: (): Promise<{ clients: ClientListItem[] }> => request("/clients"),

  clientRecord: (id: string): Promise<ClientRecord> => request(`/clients/${id}`),

  setClientStage: (id: string, stage: string): Promise<{ ok: boolean }> => post(`/clients/${id}/stage`, { stage }),

  assignClient: (id: string, agentId: string): Promise<{ ok: boolean }> => post(`/clients/${id}/assign`, { agentId }),

  reviewIntake: (clientId: string, intakeId: string): Promise<{ ok: boolean }> => post(`/clients/${clientId}/review-intake`, { intakeId }),

  tasks: (): Promise<{ tasks: TaskRow[] }> => request("/tasks"),

  completeTask: (id: string): Promise<{ ok: boolean }> => post(`/tasks/${id}/done`),

  appointments: (): Promise<{ appointments: AppointmentRow[] }> => request("/appointments"),

  team: (): Promise<{ team: { id: string; name: string; email: string; role: Role; active?: number; is_test?: number; created_at: number }[] }> => request("/team"),

  setUserRole: (id: string, role: Role): Promise<{ ok: boolean }> => post(`/users/${id}/role`, { role }),

  audit: (): Promise<{ audit: { id: string; at: number; actor_id: string; actor_role: string; action: string; target: string; detail: string }[] }> =>
    request("/audit"),

  /* ------------------------------ Sprint 2 API ------------------------------ */

  // Documents
  myDocuments: (): Promise<{ requests: DocumentRequestRow[]; documents: DocumentRow[] }> => request("/me/documents"),
  uploadDocument: (requestId: string, file: File): Promise<{ ok: boolean; documentId: string }> => {
    const form = new FormData();
    form.append("requestId", requestId);
    form.append("file", file);
    return upload("/me/documents/upload", form);
  },
  documentFile: (id: string): Promise<Blob> => download(`/documents/${id}/file`),
  requestDocument: (
    clientId: string,
    body: { category: string; documentType: string; instructions?: string; dueDate?: string; required?: boolean },
  ): Promise<{ ok: boolean; requestId: string }> => post(`/clients/${clientId}/document-requests`, body),
  reviewDocument: (clientId: string, docId: string, action: string, note: string): Promise<{ ok: boolean }> =>
    post(`/clients/${clientId}/documents/${docId}/review`, { action, note }),

  // Authorizations
  myAuthorizations: (): Promise<{ authorizations: { id: string; template_name: string; template_version: number; status: string; signed_at: number | null; signer_name: string; method: string }[] }> =>
    request("/me/authorizations"),
  authorizationText: (
    id: string,
  ): Promise<{ authorization: { id: string; template_name: string; template_version: number; status: string; signed_at: number | null; signer_name: string; method: string; text: string } }> =>
    request(`/me/authorizations/${id}`),
  signAuthorization: (id: string, signature: string, agreed: boolean): Promise<{ ok: boolean }> =>
    post(`/me/authorizations/${id}/sign`, { signature, agreed }),
  templates: (): Promise<{ templates: TemplateRow[] }> => request("/templates"),
  createTemplateVersion: (body: { templateKey: string; name: string; body: string; activate?: boolean }): Promise<{ ok: boolean; version: number }> =>
    post("/templates", body),
  sendAuthorization: (clientId: string, templateId: string): Promise<{ ok: boolean; authorizationId: string }> =>
    post(`/clients/${clientId}/authorizations/send`, { templateId }),

  // Quote presentations
  myQuotes: (): Promise<{ quotes: ClientQuoteRow[] }> => request("/me/quotes"),
  quoteViewed: (id: string): Promise<{ ok: boolean }> => post(`/me/quotes/${id}/view`),
  quoteInterest: (id: string, optionId: string): Promise<{ ok: boolean }> => post(`/me/quotes/${id}/interest`, { optionId }),
  quoteSave: (id: string, optionId: string): Promise<{ ok: boolean }> => post(`/me/quotes/${id}/save`, { optionId }),
  quoteAsk: (id: string, message: string): Promise<{ ok: boolean }> => post(`/me/quotes/${id}/ask`, { message }),
  quotes: (): Promise<{ quotes: QuotePresentationRow[] }> => request("/quotes"),
  quoteDetail: (id: string): Promise<{ quote: QuotePresentationRow; options: QuoteOptionRow[]; interactions: { action: string; option_id: string; message: string; at: number }[] }> =>
    request(`/quotes/${id}`),
  createQuote: (clientId: string, body: { title: string; coverageArea?: string; options: Partial<QuoteOptionRow>[] }): Promise<{ ok: boolean; presentationId: string }> =>
    post(`/clients/${clientId}/quotes`, body),
  setQuoteStatus: (id: string, status: string): Promise<{ ok: boolean }> => post(`/quotes/${id}/status`, { status }),

  /* ------------------------------ Sprint 3 API ------------------------------ */

  // Secure messaging
  myMessages: (): Promise<{ conversation: { id: string; subject: string; status: string; agent: { id: string; name: string; email: string; phone: string } | null }; messages: MessageRow[]; unread: number }> =>
    request("/me/messages"),
  sendMessage: (body: string): Promise<{ ok: boolean }> => post("/me/messages", { body }),
  markMessagesRead: (): Promise<{ ok: boolean }> => post("/me/messages/read"),
  conversations: (unreadOnly?: boolean): Promise<{ conversations: StaffConversationRow[] }> => request(`/conversations${unreadOnly ? "?unread=1" : ""}`),
  conversationDetail: (id: string): Promise<{ conversation: StaffConversationRow & { clientName: string; agentName: string | null }; messages: MessageRow[] }> =>
    request(`/conversations/${id}`),
  staffReply: (id: string, body: string): Promise<{ ok: boolean }> => post(`/conversations/${id}/reply`, { body }),

  // Internal notes (staff only — never returned by client routes)
  addInternalNote: (clientId: string, body: string): Promise<{ ok: boolean; noteId: string }> => post(`/clients/${clientId}/notes`, { body }),

  // Service tickets
  myTickets: (): Promise<{ tickets: TicketRow[] }> => request("/me/tickets"),
  createTicket: (category: string, description: string): Promise<{ ok: boolean; ticketId: string; ticketNumber: string }> =>
    post("/me/tickets", { category, description }),
  ticketDetailClient: (id: string): Promise<{ ticket: TicketRow; comments: TicketCommentRow[] }> => request(`/me/tickets/${id}`),
  ticketReplyClient: (id: string, body: string): Promise<{ ok: boolean }> => post(`/me/tickets/${id}/reply`, { body }),
  tickets: (params?: { status?: string; assigned?: string }): Promise<{ tickets: TicketRow[] }> => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.assigned) q.set("assigned", params.assigned);
    const qs = q.toString();
    return request(`/tickets${qs ? `?${qs}` : ""}`);
  },
  ticketDetailStaff: (id: string): Promise<{ ticket: TicketRow; comments: TicketCommentRow[] }> => request(`/tickets/${id}`),
  ticketAction: (id: string, body: { action: string; body?: string; internal?: boolean; status?: string; priority?: string; agentId?: string }): Promise<{ ok: boolean }> =>
    post(`/tickets/${id}/action`, body),

  // Coverage servicing records
  myPolicies: (): Promise<{ policies: PolicyRow[] }> => request("/me/policies"),
  policies: (): Promise<{ policies: PolicyRow[] }> => request("/policies"),
  createPolicy: (clientId: string, body: Record<string, unknown>): Promise<{ ok: boolean; policyId: string }> => post(`/clients/${clientId}/policies`, body),
  updatePolicy: (id: string, body: Record<string, unknown>): Promise<{ ok: boolean }> => post(`/policies/${id}/update`, body),

  // Renewals
  myRenewals: (): Promise<{ renewals: RenewalRow[] }> => request("/me/renewals"),
  renewals: (status?: string): Promise<{ renewals: RenewalRow[] }> => request(`/renewals${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  createRenewal: (clientId: string, body: { policyId: string; renewalDate: string; renewalPeriod?: string }): Promise<{ ok: boolean; renewalId: string }> =>
    post(`/clients/${clientId}/renewals`, body),
  renewalAction: (id: string, body: { action: string; status?: string; notes?: string; outcome?: string; agentId?: string }): Promise<{ ok: boolean }> =>
    post(`/renewals/${id}/action`, body),

  // Referrals (tracking only — no incentive payouts)
  myReferrals: (): Promise<{ referrals: ReferralRow[] }> => request("/me/referrals"),
  submitReferral: (body: { name: string; email?: string; phone?: string; relationship?: string; message?: string; consent: boolean }): Promise<{ ok: boolean; referralId: string }> =>
    post("/me/referrals", body),
  referrals: (): Promise<{ referrals: ReferralRow[] }> => request("/referrals"),
  referralAction: (id: string, body: { action: string; status?: string; convertedClientId?: string }): Promise<{ ok: boolean }> => post(`/referrals/${id}/action`, body),

  // Communication preferences
  myPreferences: (): Promise<{ preferences: CommPrefs }> => request("/me/preferences"),
  savePreferences: (body: { portal?: boolean; email?: boolean; sms?: boolean; phone?: boolean; preferredLanguage?: string }): Promise<{ ok: boolean }> =>
    post("/me/preferences", body),

  // Welcome center
  myWelcome: (): Promise<WelcomeState> => request("/me/welcome"),
  completeWelcomeItem: (itemKey: string): Promise<{ ok: boolean }> => post("/me/welcome", { itemKey }),

  // Outbound delivery log (email/SMS show not_configured until a provider exists)
  deliveries: (): Promise<{ deliveries: DeliveryRow[] }> => request("/deliveries"),

  /* ------------------------------ Sprint 4 API ------------------------------ */

  // Management analytics (manager+; agents get 403 server-side)
  analytics: (params?: { from?: string; to?: string; agentId?: string; product?: string; source?: string; includeTests?: boolean }): Promise<AnalyticsResponse> => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.agentId) q.set("agentId", params.agentId);
    if (params?.product) q.set("product", params.product);
    if (params?.source) q.set("source", params.source);
    if (params?.includeTests) q.set("includeTests", "1");
    const qs = q.toString();
    return request(`/analytics${qs ? `?${qs}` : ""}`);
  },

  // Commission ledger (manager+)
  commissions: (params?: { carrier?: string; status?: string; agentId?: string }): Promise<{ commissions: CommissionRecordRow[]; summary: CommissionSummary }> => {
    const q = new URLSearchParams();
    if (params?.carrier) q.set("carrier", params.carrier);
    if (params?.status) q.set("status", params.status);
    if (params?.agentId) q.set("agentId", params.agentId);
    const qs = q.toString();
    return request(`/commissions${qs ? `?${qs}` : ""}`);
  },
  createCommission: (body: Record<string, unknown>): Promise<{ ok: boolean; commissionId: string }> => post("/commissions", body),
  commissionAction: (id: string, body: Record<string, unknown>): Promise<{ ok: boolean }> => post(`/commissions/${id}/action`, body),

  // Compliance center (manager+; approve/reject = compliance+)
  licenses: (): Promise<{ licenses: LicenseRow[] }> => request("/compliance/licenses"),
  createLicense: (body: Record<string, unknown>): Promise<{ ok: boolean; licenseId: string }> => post("/compliance/licenses", body),
  carrierAppointments: (): Promise<{ appointments: CarrierAppointmentRow[] }> => request("/compliance/carrier-appointments"),
  createCarrierAppointment: (body: Record<string, unknown>): Promise<{ ok: boolean }> => post("/compliance/carrier-appointments", body),
  certifications: (): Promise<{ certifications: CertificationRow[] }> => request("/compliance/certifications"),
  createCertification: (body: Record<string, unknown>): Promise<{ ok: boolean }> => post("/compliance/certifications", body),
  marketingReviews: (): Promise<{ reviews: MarketingReviewRow[] }> => request("/compliance/marketing"),
  createMarketingReview: (body: { title: string; campaign?: string; content: string }): Promise<{ ok: boolean; reviewId: string }> => post("/compliance/marketing", body),
  marketingAction: (id: string, action: string, notes?: string): Promise<{ ok: boolean }> => post(`/compliance/marketing/${id}/action`, { action, notes }),
  complaints: (): Promise<{ complaints: ComplaintRow[] }> => request("/compliance/complaints"),
  createComplaint: (body: Record<string, unknown>): Promise<{ ok: boolean; complaintId: string }> => post("/compliance/complaints", body),
  complaintAction: (id: string, body: Record<string, unknown>): Promise<{ ok: boolean }> => post(`/compliance/complaints/${id}/action`, body),
  complaintNote: (id: string, body: string): Promise<{ ok: boolean }> => post(`/compliance/complaints/${id}/notes`, { body }),
  retentionPolicies: (): Promise<{ policies: RetentionPolicyRow[]; note: string }> => request("/compliance/retention"),
  saveRetention: (body: { recordType: string; retentionDays?: number; hold?: boolean; notes?: string }): Promise<{ ok: boolean }> => post("/compliance/retention", body),

  // Communication templates (activation = compliance+)
  commTemplates: (): Promise<{ templates: CommTemplateRow[] }> => request("/comm-templates"),
  createCommTemplate: (body: { templateKey: string; channel: string; language?: string; subject?: string; body: string; activate?: boolean }): Promise<{ ok: boolean; version: number }> =>
    post("/comm-templates", body),
  commTemplateAction: (id: string, action: "activate" | "deactivate"): Promise<{ ok: boolean }> => post(`/comm-templates/${id}/action`, { action }),

  // Calendar operations
  appointmentAction: (id: string, body: { action: string; date?: string; time?: string; agentId?: string }): Promise<{ ok: boolean }> => post(`/appointments/${id}/action`, body),
  availability: (): Promise<{ availability: { id: string; agent_id?: string; agent_name?: string; weekday: number; start_time: string; end_time: string }[] }> => request("/availability"),
  saveAvailability: (body: { weekday: number; startTime: string; endTime: string; agentId?: string }): Promise<{ ok: boolean }> => post("/availability", body),
  calendarStatus: (): Promise<{ provider: string; externalSync: string; authoritative: string; note: string }> => request("/calendar/status"),

  // Security center (view = manager+; actions = super admin)
  securityEvents: (): Promise<{ events: SecurityEventRow[]; activeSessions: number }> => request("/security/events"),
  revokeSessions: (userId: string): Promise<{ ok: boolean; revoked: number }> => post("/security/sessions/revoke", { userId }),
  setUserActive: (id: string, active: boolean, confirm?: string): Promise<{ ok: boolean }> =>
    post(`/security/users/${id}/${active ? "activate" : "deactivate"}`, { confirm }),
  adminResetPassword: (id: string): Promise<{ ok: boolean; temporaryPassword: string }> => post(`/security/users/${id}/reset-password`),

  // Exports & backups (downloaded files; every export is audit-logged)
  exportData: (dataset: string, format: "csv" | "json" = "csv"): Promise<Blob> => download(`/export/${dataset}?format=${format}`),
  systemBackup: (): Promise<Blob> => download("/system/backup"),
  backupStatus: (): Promise<{ lastBackup: { at: number; kind: string; record_count: number; created_by: string; note: string } | null; method: string; automated: boolean; note: string }> =>
    request("/system/backup/status"),
  systemHealth: (): Promise<SystemHealthResponse> => request("/system/health"),

  // Test-data isolation (super admin)
  flagTestData: (body: { userId?: string; clientId?: string; isTest: boolean }): Promise<{ ok: boolean }> => post("/admin/test-data/flag", body),
  purgeTestData: (confirm: string): Promise<{ ok: boolean; deleted: Record<string, number> }> => post("/admin/purge-test-data", { confirm }),

  // Launch readiness (manager+)
  launchChecklist: (): Promise<LaunchChecklistResponse> => request("/launch-checklist"),
  setLaunchFlag: (key: string, value: boolean): Promise<{ ok: boolean }> => post("/launch-checklist/flag", { key, value }),

  // Legal / consent (public list; client acceptance; compliance publishing)
  publicLegal: (): Promise<{ documents: LegalDocRow[] }> => request("/legal"),
  myLegal: (): Promise<{ documents: LegalDocRow[]; acceptances: { doc_key: string; version: number; accepted_at: number }[] }> => request("/me/legal"),
  acceptLegal: (docKey: string, version: number): Promise<{ ok: boolean }> => post("/me/legal/accept", { docKey, version }),
  upsertLegal: (body: { docKey: string; title: string; body: string; activate?: boolean }): Promise<{ ok: boolean; version: number }> => post("/legal", body),
};
