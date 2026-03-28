const DEFAULT_PAYMENT_METHODS = [
  ['Cash', 'Physical cash payment'],
  ['M-Pesa', 'Mobile money via M-Pesa'],
  ['Tigo Pesa', 'Mobile money via Tigo Pesa'],
  ['Airtel Money', 'Mobile money via Airtel'],
  ['Bank Transfer', 'Direct bank transfer'],
  ['Cheque', 'Payment by cheque'],
];

const DEFAULT_SETTINGS = [
  ['currency', 'TZS', 'general'],
  ['currency_symbol', 'TZS', 'general'],
  ['reminder_days', '7', 'notifications'],
  ['late_fee_percentage', '5', 'payments'],
  ['receipt_footer', 'Thank you for your payment. Please retain this receipt.', 'receipts'],
  ['tax_rate', '0', 'payments'],
];

const slugifyOrganizationName = (value = '') =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'landlordpro';

const ensureOrganizationDefaults = async (executor, organizationId, overrides = {}) => {
  const settingEntries = [
    ['business_name', overrides.business_name || 'LandlordPro', 'general'],
    ['business_phone', overrides.business_phone || '', 'general'],
    ['business_email', overrides.business_email || '', 'general'],
    ['business_address', overrides.business_address || '', 'general'],
    ...DEFAULT_SETTINGS,
  ];

  for (const [key, value, group] of settingEntries) {
    await executor.execute(
      `INSERT INTO settings (organization_id, setting_key, setting_value, setting_group)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (organization_id, setting_key) DO UPDATE
       SET setting_value = EXCLUDED.setting_value,
           setting_group = EXCLUDED.setting_group,
           updated_at = NOW()`,
      [organizationId, key, value, group]
    );
  }

  for (const [name, description] of DEFAULT_PAYMENT_METHODS) {
    await executor.execute(
      `INSERT INTO payment_methods (organization_id, name, description, is_active)
       VALUES (?, ?, ?, TRUE)
       ON CONFLICT (organization_id, name) DO NOTHING`,
      [organizationId, name, description]
    );
  }
};

module.exports = {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_SETTINGS,
  ensureOrganizationDefaults,
  slugifyOrganizationName,
};
