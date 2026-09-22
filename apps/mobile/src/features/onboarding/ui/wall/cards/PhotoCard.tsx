import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';

import { fontFamily } from '@/theme/fonts';

import { wallText } from '../styles';
import { CardShell } from './CardShell';

/**
 * `.photo`: a placeholder photo, edge to edge, with a caption in the corner. The scenes are
 * the welcome reference's `photo()`, a 120 by 84 view box, ported verbatim; they are not the
 * Relive placeholders in `components/reference/PhotoScene.tsx`, which are drawn 90 by 90.
 */
export const PhotoCard = React.memo(function PhotoCard({
  scene,
  sky,
  caption,
}: {
  scene: 'field' | 'board';
  sky: string;
  caption: string;
}) {
  return (
    <CardShell style={{ padding: 0, borderWidth: 0, backgroundColor: '#0E1424' }}>
      <View style={{ width: '100%', aspectRatio: 120 / 84 }}>
        <Svg width="100%" height="100%" viewBox="0 0 120 84">
          {scene === 'field' ? (
            <>
              <Rect width="120" height="84" fill={sky} />
              <Path d="M0 34h120v50H0z" fill="#2E7D4F" />
              <Path d="M60 80 26 52l34-19 34 19z" fill="#C49A6C" />
              <Path d="M60 72 44 58l16-10 16 10z" fill="#3A8D5C" />
              <Rect x="6" y="8" width="13" height="7" fill="#FFF6C8" />
              <Rect x="101" y="8" width="13" height="7" fill="#FFF6C8" />
              <Path d="M12 15v19M108 15v19" stroke="#DDE3EA" strokeWidth="2" />
            </>
          ) : (
            <>
              <Rect width="120" height="84" fill={sky} />
              <Rect x="14" y="14" width="92" height="46" rx="5" fill="#141A22" stroke="#39434F" />
              <SvgText
                x="60"
                y="46"
                textAnchor="middle"
                fontFamily={fontFamily({ weight: 900 })}
                fontSize="22"
                fill="#FFD166"
              >
                6 – 3
              </SvgText>
              <Path d="M0 66h120v18H0z" fill="#232830" />
            </>
          )}
        </Svg>
      </View>
      {/* `.cap`: `left:8px; bottom:6px`, 9.5px at 85% white with a soft shadow. */}
      <Text
        allowFontScaling={false}
        style={[
          wallText({ size: 9.5, line: 12.35, color: 'rgba(255,255,255,0.85)' }),
          {
            position: 'absolute',
            left: 8,
            bottom: 6,
            textShadowColor: 'rgba(0,0,0,0.7)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          },
        ]}
      >
        {caption}
      </Text>
    </CardShell>
  );
});
