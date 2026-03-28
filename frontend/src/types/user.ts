export type RoleOption = {
  id: number;
  name: string;
  description?: string;
};

export type StaffUser = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  invited_at?: string | null;
  invite_expires_at?: string | null;
  password_set_at?: string | null;
  invitation_pending?: boolean;
};
