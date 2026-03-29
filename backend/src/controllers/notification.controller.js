const { pool } = require('../database/db');

const DEFAULT_RENT_REMINDER_DAYS = 7;
const DEFAULT_LEASE_REMINDER_DAYS = 30;
const LOW_OCCUPANCY_THRESHOLD = 0.6;

const toNumber = (value) => Number(value || 0);

const buildTenantActionUrl = (tenantId) => (tenantId ? `/tenants/${tenantId}` : '/tenants');
const buildPropertyActionUrl = (propertyId) => (propertyId ? `/properties/${propertyId}` : '/properties');

const getAlertSeverity = (daysRemaining) => {
  if (daysRemaining <= 0) {
    return 'critical';
  }

  if (daysRemaining <= 3) {
    return 'warning';
  }

  return 'info';
};

const buildOverdueAlerts = (rows) =>
  rows.map((row) => {
    const daysOverdue = toNumber(row.days_overdue);
    const outstandingBalance = Math.max(toNumber(row.outstanding_balance), toNumber(row.monthly_rent));

    return {
      id: `overdue-${row.id}`,
      category: 'overdue_rent',
      severity: 'critical',
      title: `${row.full_name} has overdue rent`,
      message: `${row.full_name} at ${row.property_name || 'an unassigned property'} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue.`,
      action_label: 'Review tenant',
      action_url: buildTenantActionUrl(row.id),
      created_at: row.next_due_date,
      due_date: row.next_due_date,
      tenant: {
        id: row.id,
        full_name: row.full_name,
        phone: row.phone,
      },
      property: {
        id: row.property_id,
        name: row.property_name,
      },
      unit: row.unit_number ? { unit_number: row.unit_number } : null,
      metrics: {
        amount: outstandingBalance,
        days_overdue: daysOverdue,
      },
      source: 'monitor',
    };
  });

const buildDueSoonAlerts = (rows) =>
  rows.map((row) => {
    const daysUntilDue = toNumber(row.days_until_due);

    return {
      id: `due-soon-${row.id}`,
      category: 'upcoming_rent',
      severity: getAlertSeverity(daysUntilDue),
      title: `${row.full_name} has rent coming up`,
      message: `${row.full_name}${row.unit_number ? ` in Unit ${row.unit_number}` : ''} is due on ${row.next_due_date}.`,
      action_label: 'Open tenant',
      action_url: buildTenantActionUrl(row.id),
      created_at: row.next_due_date,
      due_date: row.next_due_date,
      tenant: {
        id: row.id,
        full_name: row.full_name,
        phone: row.phone,
      },
      property: {
        id: row.property_id,
        name: row.property_name,
      },
      unit: row.unit_number ? { unit_number: row.unit_number } : null,
      metrics: {
        amount: toNumber(row.monthly_rent),
        days_until_due: daysUntilDue,
      },
      source: 'monitor',
    };
  });

const buildLeaseAlerts = (rows) =>
  rows.map((row) => {
    const daysRemaining = toNumber(row.days_until_lease_end);
    const expired = daysRemaining < 0;

    return {
      id: `lease-${row.id}`,
      category: 'lease_deadline',
      severity: expired ? 'critical' : getAlertSeverity(daysRemaining),
      title: expired ? `${row.full_name}'s lease has expired` : `${row.full_name}'s lease is nearing its end`,
      message: expired
        ? `Lease ended on ${row.lease_end}. Follow up for renewal, move-out, or handover.`
        : `Lease ends on ${row.lease_end}, which is in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
      action_label: 'Review lease',
      action_url: buildTenantActionUrl(row.id),
      created_at: row.lease_end,
      due_date: row.lease_end,
      tenant: {
        id: row.id,
        full_name: row.full_name,
        phone: row.phone,
      },
      property: {
        id: row.property_id,
        name: row.property_name,
      },
      unit: row.unit_number ? { unit_number: row.unit_number } : null,
      metrics: {
        days_until_lease_end: daysRemaining,
      },
      source: 'monitor',
    };
  });

const buildMaintenanceAlerts = (rows) =>
  rows.map((row) => ({
    id: `maintenance-${row.id}`,
    category: 'maintenance',
    severity: 'warning',
    title: `${row.property_name || 'Property'} unit ${row.unit_number} is marked for maintenance`,
    message: `Unit ${row.unit_number} is unavailable for leasing until maintenance is resolved.`,
    action_label: 'Open property',
    action_url: buildPropertyActionUrl(row.property_id),
    created_at: row.updated_at || row.created_at,
    property: {
      id: row.property_id,
      name: row.property_name,
    },
    unit: {
      id: row.id,
      unit_number: row.unit_number,
      unit_type: row.unit_type,
    },
    source: 'monitor',
  }));

const buildOccupancyAlerts = (rows) =>
  rows.map((row) => {
    const totalUnits = toNumber(row.total_units);
    const occupiedUnits = toNumber(row.occupied_units);
    const vacantUnits = toNumber(row.vacant_units);
    const occupancyRate = totalUnits > 0 ? occupiedUnits / totalUnits : 0;
    const severity = occupancyRate < 0.4 ? 'warning' : 'info';

    return {
      id: `occupancy-${row.id}`,
      category: 'property_update',
      severity,
      title: `${row.name} needs leasing attention`,
      message: `${vacantUnits} of ${totalUnits} unit${totalUnits === 1 ? '' : 's'} are vacant. Occupancy is ${(occupancyRate * 100).toFixed(0)}%.`,
      action_label: 'View property',
      action_url: buildPropertyActionUrl(row.id),
      created_at: row.updated_at || row.created_at,
      property: {
        id: row.id,
        name: row.name,
      },
      metrics: {
        total_units: totalUnits,
        occupied_units: occupiedUnits,
        vacant_units: vacantUnits,
        occupancy_rate: occupancyRate,
      },
      source: 'monitor',
    };
  });

const buildActivityAlerts = (rows) =>
  rows.map((row) => ({
    id: `activity-${row.id}`,
    category: 'recent_activity',
    severity:
      row.type === 'payment_received'
        ? 'success'
        : row.type === 'overdue'
          ? 'critical'
          : row.type === 'due_soon'
            ? 'warning'
            : 'info',
    title: row.title,
    message: row.message,
    action_label: row.tenant_id ? 'Open tenant' : 'Open alerts',
    action_url: row.tenant_id ? buildTenantActionUrl(row.tenant_id) : '/notifications',
    created_at: row.created_at,
    is_read: Boolean(row.is_read),
    tenant: row.tenant_id
      ? {
          id: row.tenant_id,
          full_name: row.tenant_name,
        }
      : null,
    property: row.property_id
      ? {
          id: row.property_id,
          name: row.property_name,
        }
      : null,
    source: 'activity',
    activity_type: row.type,
  }));

const sortAlerts = (alerts) =>
  alerts.sort((left, right) => {
    const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
    const severityDiff = severityOrder[left.severity] - severityOrder[right.severity];

    if (severityDiff !== 0) {
      return severityDiff;
    }

    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
  });

const buildSummary = (alerts) => {
  const summary = {
    total: alerts.length,
    critical: 0,
    warning: 0,
    info: 0,
    success: 0,
    overdue_rent: 0,
    upcoming_rent: 0,
    lease_deadline: 0,
    maintenance: 0,
    property_update: 0,
    recent_activity: 0,
  };

  alerts.forEach((alert) => {
    summary[alert.severity] += 1;
    summary[alert.category] += 1;
  });

  return summary;
};

const getAll = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const [settingsRows] = await pool.execute(
      `SELECT setting_key, setting_value
       FROM settings
       WHERE organization_id = ?
         AND setting_key IN ('reminder_days', 'lease_reminder_days')`,
      [organizationId]
    );

    const settings = Object.fromEntries(settingsRows.map((row) => [row.setting_key, row.setting_value]));
    const rentReminderDays = Number(settings.reminder_days || DEFAULT_RENT_REMINDER_DAYS);
    const leaseReminderDays = Number(settings.lease_reminder_days || DEFAULT_LEASE_REMINDER_DAYS);

    const [overdueRows] = await pool.execute(
      `SELECT t.id, t.property_id, t.full_name, t.phone, t.next_due_date, t.monthly_rent, t.outstanding_balance,
              p.name AS property_name, u.unit_number,
              GREATEST((CURRENT_DATE - t.next_due_date), 0) AS days_overdue
       FROM tenants t
       LEFT JOIN properties p ON p.id = t.property_id AND p.organization_id = t.organization_id
       LEFT JOIN units u ON u.id = t.unit_id AND u.organization_id = t.organization_id
       WHERE t.organization_id = ?
         AND t.is_active = TRUE
         AND t.next_due_date < CURRENT_DATE
         AND t.payment_status <> 'paid'
       ORDER BY t.next_due_date ASC`,
      [organizationId]
    );

    const [dueSoonRows] = await pool.execute(
      `SELECT t.id, t.property_id, t.full_name, t.phone, t.next_due_date, t.monthly_rent,
              p.name AS property_name, u.unit_number,
              (t.next_due_date - CURRENT_DATE) AS days_until_due
       FROM tenants t
       LEFT JOIN properties p ON p.id = t.property_id AND p.organization_id = t.organization_id
       LEFT JOIN units u ON u.id = t.unit_id AND u.organization_id = t.organization_id
       WHERE t.organization_id = ?
         AND t.is_active = TRUE
         AND t.next_due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + ?::int)
         AND t.payment_status <> 'paid'
       ORDER BY t.next_due_date ASC`,
      [organizationId, rentReminderDays]
    );

    const [leaseRows] = await pool.execute(
      `SELECT t.id, t.property_id, t.full_name, t.phone, t.lease_end,
              p.name AS property_name, u.unit_number,
              (t.lease_end - CURRENT_DATE) AS days_until_lease_end
       FROM tenants t
       LEFT JOIN properties p ON p.id = t.property_id AND p.organization_id = t.organization_id
       LEFT JOIN units u ON u.id = t.unit_id AND u.organization_id = t.organization_id
       WHERE t.organization_id = ?
         AND t.is_active = TRUE
         AND t.lease_end IS NOT NULL
         AND t.lease_end <= (CURRENT_DATE + ?::int)
       ORDER BY t.lease_end ASC`,
      [organizationId, leaseReminderDays]
    );

    const [maintenanceRows] = await pool.execute(
      `SELECT u.id, u.property_id, u.unit_number, u.unit_type, u.created_at, u.updated_at, p.name AS property_name
       FROM units u
       LEFT JOIN properties p ON p.id = u.property_id AND p.organization_id = u.organization_id
       WHERE u.organization_id = ?
         AND u.status = 'maintenance'
       ORDER BY COALESCE(u.updated_at, u.created_at) DESC`,
      [organizationId]
    );

    const [occupancyRows] = await pool.execute(
      `SELECT p.id, p.name, p.created_at, p.updated_at,
              COUNT(u.id) AS total_units,
              SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END) AS occupied_units,
              SUM(CASE WHEN u.status = 'vacant' THEN 1 ELSE 0 END) AS vacant_units
       FROM properties p
       LEFT JOIN units u ON u.property_id = p.id AND u.organization_id = p.organization_id
       WHERE p.organization_id = ?
         AND p.status = 'active'
       GROUP BY p.id, p.name, p.created_at, p.updated_at
       HAVING COUNT(u.id) > 0
          AND (
            SUM(CASE WHEN u.status = 'vacant' THEN 1 ELSE 0 END) > 0
            AND (
              SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(u.id), 0)
            ) < ?
          )
       ORDER BY vacant_units DESC, p.name ASC`,
      [organizationId, LOW_OCCUPANCY_THRESHOLD]
    );

    const [activityRows] = await pool.execute(
      `SELECT n.id, n.type, n.title, n.message, n.created_at, n.is_read, n.tenant_id,
              t.full_name AS tenant_name, t.property_id,
              p.name AS property_name
       FROM notifications n
       LEFT JOIN tenants t ON t.id = n.tenant_id AND t.organization_id = n.organization_id
       LEFT JOIN properties p ON p.id = t.property_id AND p.organization_id = n.organization_id
       WHERE n.organization_id = ?
         AND (n.user_id = ? OR n.user_id IS NULL)
       ORDER BY n.created_at DESC
       LIMIT 12`,
      [organizationId, req.user.id]
    );

    const monitoredAlerts = sortAlerts([
      ...buildOverdueAlerts(overdueRows),
      ...buildDueSoonAlerts(dueSoonRows),
      ...buildLeaseAlerts(leaseRows),
      ...buildMaintenanceAlerts(maintenanceRows),
      ...buildOccupancyAlerts(occupancyRows),
    ]);

    const activityAlerts = buildActivityAlerts(activityRows);
    const summary = buildSummary(monitoredAlerts);

    res.json({
      unread: monitoredAlerts.length,
      summary: {
        ...summary,
        active: monitoredAlerts.length,
        recent_activity_count: activityAlerts.length,
      },
      alerts: monitoredAlerts,
      recent_activity: activityAlerts,
      notifications: monitoredAlerts,
      settings: {
        reminder_days: rentReminderDays,
        lease_reminder_days: leaseReminderDays,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch alerts.' });
  }
};

const markRead = async (req, res) => {
  try {
    if (req.params.id === 'all') {
      await pool.execute(
        'UPDATE notifications SET is_read = TRUE WHERE organization_id = ? AND (user_id = ? OR user_id IS NULL)',
        [req.user.organization_id, req.user.id]
      );
    } else {
      await pool.execute(
        'UPDATE notifications SET is_read = TRUE WHERE id = ? AND organization_id = ? AND (user_id = ? OR user_id IS NULL)',
        [req.params.id, req.user.organization_id, req.user.id]
      );
    }

    res.json({ message: 'Stored activity alerts marked as read.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update alerts.' });
  }
};

module.exports = { getAll, markRead };
