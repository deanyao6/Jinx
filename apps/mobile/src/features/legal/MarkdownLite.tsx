import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { APP_NAME } from '@/lib/app';
import { useTheme } from '@/theme/ThemeProvider';

export type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; lead: string | null; text: string }
  | { type: 'bullet'; lead: string | null; text: string }
  | { type: 'numbered'; n: string; text: string }
  | { type: 'note'; text: string };

const BOLD_LEAD = /^\*\*(.+?)\*\*\s*(.*)$/;

/** Splits Markdown-lite text into blocks. Pure, so the docs copy can be unit tested. */
export function parseMarkdownLite(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('# ')) {
      blocks.push({ type: 'heading', text: line.slice(2) });
      continue;
    }
    if (/^_.*_$/.test(line)) {
      blocks.push({ type: 'note', text: line.slice(1, -1) });
      continue;
    }
    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (numbered) {
      blocks.push({ type: 'numbered', n: numbered[1] as string, text: numbered[2] as string });
      continue;
    }
    const body = line.startsWith('- ') ? line.slice(2) : line;
    const lead = BOLD_LEAD.exec(body);
    const block = lead
      ? { lead: lead[1] as string, text: lead[2] as string }
      : { lead: null, text: body };
    blocks.push({ type: line.startsWith('- ') ? 'bullet' : 'paragraph', ...block });
  }
  return blocks;
}

function withAppName(s: string): string {
  return s.replace(/Jinx/g, APP_NAME);
}

/** Renders docs copy as plain themed text. The `# ` heading is skipped (the screen has a title). */
export function MarkdownLite({ md }: { md: string }) {
  const theme = useTheme();
  const blocks = parseMarkdownLite(md).filter((b) => b.type !== 'heading');
  return (
    <View style={{ gap: theme.spacing.md }}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'note':
            return (
              <Text key={i} variant="caption" color="muted">
                {withAppName(b.text)}
              </Text>
            );
          case 'numbered':
            return (
              <View key={i} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Text variant="bodyStrong" style={{ width: 22 }}>
                  {b.n}.
                </Text>
                <Text style={{ flex: 1 }}>{withAppName(b.text)}</Text>
              </View>
            );
          case 'bullet':
            return (
              <View key={i} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Text style={{ width: 14 }}>•</Text>
                <Text style={{ flex: 1 }}>
                  {b.lead ? <Text variant="bodyStrong">{withAppName(b.lead)} </Text> : null}
                  {withAppName(b.text)}
                </Text>
              </View>
            );
          case 'paragraph':
            return (
              <Text key={i}>
                {b.lead ? <Text variant="bodyStrong">{withAppName(b.lead)} </Text> : null}
                {withAppName(b.text)}
              </Text>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}
