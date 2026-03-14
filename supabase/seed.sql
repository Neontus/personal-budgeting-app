-- =============================================================================
-- Seed: Default system categories
-- Run after migrations via: supabase db seed
-- =============================================================================

insert into public.categories (id, user_id, name, icon, color, is_system, sort_order)
values
  (uuid_generate_v4(), null, 'Food & Dining',      'restaurant-outline',      '#FF6B6B', true,  1),
  (uuid_generate_v4(), null, 'Groceries',           'cart-outline',            '#FF9F43', true,  2),
  (uuid_generate_v4(), null, 'Transportation',      'car-outline',             '#5F27CD', true,  3),
  (uuid_generate_v4(), null, 'Shopping',            'bag-outline',             '#FF6348', true,  4),
  (uuid_generate_v4(), null, 'Entertainment',       'film-outline',            '#A29BFE', true,  5),
  (uuid_generate_v4(), null, 'Subscriptions',       'repeat-outline',          '#74B9FF', true,  6),
  (uuid_generate_v4(), null, 'Health & Medical',    'medkit-outline',          '#00CEC9', true,  7),
  (uuid_generate_v4(), null, 'Housing',             'home-outline',            '#FDCB6E', true,  8),
  (uuid_generate_v4(), null, 'Travel',              'airplane-outline',        '#6C5CE7', true,  9),
  (uuid_generate_v4(), null, 'Education',           'school-outline',          '#00B894', true,  10),
  (uuid_generate_v4(), null, 'Income',              'trending-up-outline',     '#00C896', true,  11),
  (uuid_generate_v4(), null, 'Transfers',           'swap-horizontal-outline', '#636E72', true,  12),
  (uuid_generate_v4(), null, 'Fees & Charges',      'receipt-outline',         '#D63031', true,  13),
  (uuid_generate_v4(), null, 'Uncategorized',       'help-circle-outline',     '#4A4A5A', true,  99)
on conflict (user_id, name) do nothing;
