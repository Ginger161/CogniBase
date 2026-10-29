// The team and what each person may do. Pure constants, so the admin screens can use them too.

/** Every permission a team member can be given. Anything not granted is hidden from that person entirely. */
export const PERMISSIONS = {
  'overview.view': { label: 'Overview', hint: 'See the headline numbers' },
  'users.view': { label: 'Look up users', hint: 'Find a user and see their plan, credits and usage' },
  'users.edit': { label: 'Edit users', hint: 'Give credits or a plan, pause or restore an account' },
  'billing.view': { label: 'Payments', hint: 'See payments and revenue' },
  'funds.view': { label: 'Costs and runway', hint: 'See expenses, running costs and break-even' },
  'funds.edit': { label: 'Edit costs', hint: 'Add and remove expenses' },
  'invites.manage': { label: 'Invite codes', hint: 'Create codes that give testers credits or a plan' },
  'settings.manage': { label: 'Kill switches', hint: 'Switch chat, audio, uploads or generation off and on' },
  'audit.view': { label: 'Activity log', hint: 'See what the team has done' },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(x: unknown): x is Permission {
  return typeof x === 'string' && x in PERMISSIONS;
}

/** Starting points for common jobs. The owner can still tick or untick each box. */
export const ROLE_PRESETS: Record<string, { label: string; permissions: Permission[] }> = {
  support: { label: 'Support', permissions: ['users.view', 'users.edit', 'invites.manage'] },
  finance: { label: 'Finance', permissions: ['overview.view', 'billing.view', 'funds.view', 'funds.edit'] },
  growth: { label: 'Growth', permissions: ['overview.view', 'users.view', 'invites.manage'] },
};

/** The sections of the admin area, with the permission each one needs. The Team page is owner-only. */
export const ADMIN_SECTIONS: { href: string; label: string; permission: Permission | 'owner' }[] = [
  { href: '/admin', label: 'Overview', permission: 'overview.view' },
  { href: '/admin/users', label: 'Users', permission: 'users.view' },
  { href: '/admin/payments', label: 'Payments', permission: 'billing.view' },
  { href: '/admin/funds', label: 'Funds & runway', permission: 'funds.view' },
  { href: '/admin/invites', label: 'Invite codes', permission: 'invites.manage' },
  { href: '/admin/switches', label: 'Kill switches', permission: 'settings.manage' },
  { href: '/admin/audit', label: 'Activity log', permission: 'audit.view' },
  { href: '/admin/team', label: 'Team', permission: 'owner' },
];
