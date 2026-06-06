import React from 'react';
import { View, Text } from 'react-native';

type TierType = 'Free' | 'Pro' | 'Ultra' | 'Enterprise';

interface BadgeProps {
  label: string;
  tier?: TierType;
}

const tierConfig: Record<string, { bg: string; text: string }> = {
  Free:       { bg: 'bg-gray-100',   text: 'text-gray-600'   },
  Pro:        { bg: 'bg-primary-100', text: 'text-primary-600' },
  Ultra:      { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  Enterprise: { bg: 'bg-amber-100',  text: 'text-amber-700'  }, // alias → Ultra
};

export function Badge({ label, tier }: BadgeProps) {
  const config = tier ? tierConfig[tier] : { bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <View className={`px-2 py-1 rounded-full ${config.bg}`}>
      <Text className={`text-xs font-medium ${config.text}`}>{label}</Text>
    </View>
  );
}

export function TierBadge({ tier }: { tier: TierType }) {
  const displayLabel = tier === 'Enterprise' ? 'Ultra' : tier;
  return <Badge label={displayLabel} tier={tier} />;
}
