/**
 * AppLogo — Logo chính thức của SocialSense.
 * Dùng react-native-svg để render SVG path từ docs/logo_SocialSence.svg.
 * Logo gốc viewBox="0 0 2048 1152" — scale xuống theo prop `size`.
 *
 * Usage:
 *   <AppLogo size={40} />          // icon nhỏ trong header
 *   <AppLogo size={64} />          // splash / auth screen
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface AppLogoProps {
  /** Chiều cao render (px). Width tự tính theo tỉ lệ 2048:1152 ≈ 16:9. */
  size?: number;
  color?: string;
}

export function AppLogo({ size = 40, color = '#111827' }: AppLogoProps) {
  // Tỉ lệ gốc: 2048 × 1152
  const aspectRatio = 2048 / 1152;
  const height = size;
  const width = size * aspectRatio;

  return (
    <View style={{ width, height }}>
      <Svg
        viewBox="0 0 2048 1152"
        width={width}
        height={height}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Shape trên — simplified từ logo gốc */}
        <Path
          d="M1026.0,578.5 L1025.0,578.5 L808.5,578.0 L808.5,577.0 L808.0,576.5 L766.5,530.0 L767.0,529.5 L1022.5,299.0 L1023.0,298.5 L1347.0,298.5 L1347.5,299.0 L1026.5,578.0 L1026.0,578.5 Z"
          fill={color}
        />
        {/* Shape dưới — simplified từ logo gốc */}
        <Path
          d="M1025.0,747.5 L786.0,747.5 L785.5,747.0 L785.5,618.0 L786.0,617.5 L809.0,604.5 L906.0,604.5 L906.5,605.0 L906.5,627.0 L907.0,627.5 L978.0,627.5 L978.5,627.0 L1070.5,558.0 L1070.0,557.5 L1000.0,511.5 L999.5,511.0 L1000.0,510.5 L1047.0,462.5 L1166.0,462.5 L1166.5,463.0 L1261.5,557.0 L1261.5,559.0 L1261.0,559.5 L1025.5,747.0 L1025.0,747.5 Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}
