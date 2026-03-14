// ─────────────────────────────────────────────────────────────────────────────
// Core domain types
// ─────────────────────────────────────────────────────────────────────────────

export type UUID = string;
export type ISODateString = string; // e.g. "2026-03-14"
export type ISOTimestamp = string;  // e.g. "2026-03-14T12:00:00Z"

// ─────────────────────────────────────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────────────────────────────────────

export interface Profile {
  id: UUID;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  push_token: string | null;
  telegram_chat_id: string | null;
  telegram_enabled: boolean;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Linked Accounts (Plaid Items)
// ─────────────────────────────────────────────────────────────────────────────

export type LinkedAccountStatus = 'active' | 'error' | 'disconnected';

export interface LinkedAccount {
  id: UUID;
  user_id: UUID;
  plaid_item_id: string;
  institution_name: string | null;
  institution_id: string | null;
  status: LinkedAccountStatus;
  consent_expires_at: ISOTimestamp | null;
  last_synced_at: ISOTimestamp | null;
  created_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial Accounts
// ─────────────────────────────────────────────────────────────────────────────

export type AccountType = 'depository' | 'credit' | 'loan' | 'investment';
export type AccountSubtype =
  | 'checking'
  | 'savings'
  | 'credit card'
  | 'mortgage'
  | 'student'
  | 'auto'
  | 'brokerage'
  | string;

export interface Account {
  id: UUID;
  user_id: UUID;
  linked_account_id: UUID;
  plaid_account_id: string;
  name: string;
  official_name: string | null;
  type: AccountType;
  subtype: AccountSubtype | null;
  mask: string | null;
  current_balance: number | null;
  available_balance: number | null;
  credit_limit: number | null;
  iso_currency_code: string;
  bill_due_date: number | null;       // day of month 1-31
  statement_close_date: number | null; // day of month 1-31
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────────────

export interface Category {
  id: UUID;
  user_id: UUID | null; // null = system default
  name: string;
  icon: string | null;
  color: string | null;
  parent_id: UUID | null;
  is_system: boolean;
  sort_order: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transactions
// ─────────────────────────────────────────────────────────────────────────────

export interface Transaction {
  id: UUID;
  user_id: UUID;
  account_id: UUID;
  plaid_transaction_id: string | null;
  amount: number;        // positive = debit/expense, negative = credit/refund
  merchant_name: string | null;
  name: string;
  category_id: UUID | null;
  category?: Category;   // populated join
  plaid_category: string[] | null;
  pending: boolean;
  date: ISODateString;
  authorized_date: ISODateString | null;
  auto_categorized: boolean;
  notes: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Rules
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryRule {
  id: UUID;
  user_id: UUID;
  merchant_pattern: string;
  category_id: UUID;
  priority: number;
  created_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Budgets
// ─────────────────────────────────────────────────────────────────────────────

export type BudgetPeriodType = 'weekly' | 'monthly' | 'statement_cycle';

export interface Budget {
  id: UUID;
  user_id: UUID;
  category_id: UUID | null;  // null = overall budget (all categories)
  category?: Category;
  amount: number;
  period_type: BudgetPeriodType;
  period_anchor: number | null; // day of week (0–6) or day of month (1–31)
  account_id: UUID | null;      // null = all accounts
  alert_thresholds: number[];   // e.g. [50, 80, 100]
  is_active: boolean;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface BudgetPeriod {
  id: UUID;
  budget_id: UUID;
  period_start: ISODateString;
  period_end: ISODateString;
  spent: number;
  alerted_at: Record<string, ISOTimestamp | null>; // { "50": "...", "80": null }
  created_at: ISOTimestamp;
}

// Derived: budget + current period merged for UI
export interface BudgetWithProgress extends Budget {
  current_period: BudgetPeriod | null;
  percent_used: number; // 0–100+
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'budget_alert'
  | 'bill_due'
  | 'subscription_renewal'
  | 'weekly_report'
  | 'monthly_report';

export type NotificationChannel = 'push' | 'telegram' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read';

export interface AppNotification {
  id: UUID;
  user_id: UUID;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  sent_at: ISOTimestamp | null;
  read_at: ISOTimestamp | null;
  created_at: ISOTimestamp;
}

export interface NotificationPreference {
  id: UUID;
  user_id: UUID;
  event_type: NotificationType;
  push_enabled: boolean;
  telegram_enabled: boolean;
  in_app_enabled: boolean;
}
