import React from 'react';
import { KeyboardAvoidingView, Platform, type ViewStyle } from 'react-native';

import { Screen } from './Screen';

type Props = { children: React.ReactNode; style?: ViewStyle; headerOffset?: number };

/** Screen that moves out of the keyboard's way. Use for anything with text inputs. */
export function FormScreen({ children, style, headerOffset = 0 }: Props) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerOffset}
    >
      <Screen style={style}>{children}</Screen>
    </KeyboardAvoidingView>
  );
}
