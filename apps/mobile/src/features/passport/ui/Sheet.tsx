import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  onClose: () => void;
  children: React.ReactNode;
  scroll?: boolean;
};

/** iOS page sheet with a title row and a close button. Pure presentation. */
export function Sheet({ visible, title, subtitle, onClose, children, scroll = true }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="h2">{title}</Text>
        {subtitle ? (
          <Text variant="sub" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: c.tint,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="close" size={20} color={c.ink} />
      </Pressable>
    </View>
  );
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: c.screen }}>
        {header}
        {scroll ? (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.xxl,
            }}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg }}>{children}</View>
        )}
      </View>
    </Modal>
  );
}
