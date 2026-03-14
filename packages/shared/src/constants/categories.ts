// Default system categories with Plaid personal_finance_category mappings
// https://plaid.com/docs/api/products/transactions/#transactions-get-response-transactions-personal-finance-category

export interface SystemCategory {
  name: string;
  icon: string;           // Ionicons name
  color: string;          // hex
  plaidPrimary: string[]; // Plaid primary categories that map here
}

export const SYSTEM_CATEGORIES: SystemCategory[] = [
  {
    name: 'Food & Dining',
    icon: 'restaurant-outline',
    color: '#FF6B6B',
    plaidPrimary: ['FOOD_AND_DRINK'],
  },
  {
    name: 'Groceries',
    icon: 'cart-outline',
    color: '#FF9F43',
    plaidPrimary: [], // Plaid subcategory: FOOD_AND_DRINK > GROCERIES
  },
  {
    name: 'Transportation',
    icon: 'car-outline',
    color: '#5F27CD',
    plaidPrimary: ['TRANSPORTATION'],
  },
  {
    name: 'Shopping',
    icon: 'bag-outline',
    color: '#FF6348',
    plaidPrimary: ['GENERAL_MERCHANDISE', 'CLOTHING_AND_ACCESSORIES'],
  },
  {
    name: 'Entertainment',
    icon: 'film-outline',
    color: '#A29BFE',
    plaidPrimary: ['ENTERTAINMENT'],
  },
  {
    name: 'Subscriptions',
    icon: 'repeat-outline',
    color: '#74B9FF',
    plaidPrimary: ['SUBSCRIPTION'],
  },
  {
    name: 'Health & Medical',
    icon: 'medkit-outline',
    color: '#00CEC9',
    plaidPrimary: ['MEDICAL', 'PERSONAL_CARE'],
  },
  {
    name: 'Housing',
    icon: 'home-outline',
    color: '#FDCB6E',
    plaidPrimary: ['RENT_AND_UTILITIES', 'HOME_IMPROVEMENT'],
  },
  {
    name: 'Travel',
    icon: 'airplane-outline',
    color: '#6C5CE7',
    plaidPrimary: ['TRAVEL'],
  },
  {
    name: 'Education',
    icon: 'school-outline',
    color: '#00B894',
    plaidPrimary: ['EDUCATION'],
  },
  {
    name: 'Income',
    icon: 'trending-up-outline',
    color: '#00C896',
    plaidPrimary: ['INCOME'],
  },
  {
    name: 'Transfers',
    icon: 'swap-horizontal-outline',
    color: '#636E72',
    plaidPrimary: ['TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS'],
  },
  {
    name: 'Fees & Charges',
    icon: 'receipt-outline',
    color: '#D63031',
    plaidPrimary: ['BANK_FEES', 'OTHER_PAYMENT'],
  },
  {
    name: 'Uncategorized',
    icon: 'help-circle-outline',
    color: '#4A4A5A',
    plaidPrimary: ['OTHER'],
  },
];

// Quick lookup: Plaid primary → system category name
export const PLAID_TO_SYSTEM_CATEGORY: Record<string, string> = {};
for (const cat of SYSTEM_CATEGORIES) {
  for (const plaidPrimary of cat.plaidPrimary) {
    PLAID_TO_SYSTEM_CATEGORY[plaidPrimary] = cat.name;
  }
}

export const BUDGET_PERIOD_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  statement_cycle: 'Statement Cycle',
};
