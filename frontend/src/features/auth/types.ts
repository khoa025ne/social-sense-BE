export type Tier = 'Free' | 'Pro' | 'Ultra' | 'Enterprise';

export interface AuthUser {
  userId: number;
  email: string;
  displayName: string;
  roles: string[];
  tier: Tier;
  hasContext: boolean;
}
