import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'TZS') {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

export function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'paid': return 'status-paid';
    case 'due_soon': return 'status-due-soon';
    case 'overdue': return 'status-overdue';
    case 'partial': return 'status-partial';
    case 'vacant': return 'status-vacant';
    case 'occupied': return 'status-active';
    case 'active': return 'status-active';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}
