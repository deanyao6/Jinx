import React from 'react';
import { View } from 'react-native';

import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { parseMarkdownLite, type Block } from '@/features/legal/MarkdownLite';
import { APP_NAME } from '@/lib/app';
import { useTheme } from '@/theme/ThemeProvider';

/** Long copy is set looser than the interface: 15 on 24, against the body's 15 on 21. */
const LINE = 24;

type Section = { title: string | null; blocks: Block[] };

function named(s: string): string {
  return s.replace(/Jinx/g, APP_NAME);
}

/**
 * A bold lead-in alone on its line ("**What we collect**") is a section heading in the docs
 * copy. What follows belongs to it. The words themselves are untouched.
 */
export function legalSections(md: string): { notes: string[]; sections: Section[] } {
  const notes: string[] = [];
  const sections: Section[] = [];
  for (const block of parseMarkdownLite(md)) {
    if (block.type === 'heading') continue;
    if (block.type === 'note' && sections.length === 0) {
      notes.push(block.text);
      continue;
    }
    if (block.type === 'paragraph' && block.lead && !block.text) {
      sections.push({ title: block.lead, blocks: [] });
      continue;
    }
    const last = sections[sections.length - 1];
    // "**Sharing**: profiles are public..." after a headed list is a new thought, not one more
    // item under that heading, so it starts a card of its own.
    const leaves = block.type === 'paragraph' && block.lead != null && last?.title != null;
    if (last && !leaves) last.blocks.push(block);
    else sections.push({ title: null, blocks: [block] });
  }
  return { notes, sections: sections.filter((s) => s.title || s.blocks.length) };
}

function BlockText({ block }: { block: Block }) {
  const theme = useTheme();
  const body = { lineHeight: LINE } as const;
  switch (block.type) {
    case 'note':
      return (
        <Text variant="caption" color="muted">
          {named(block.text)}
        </Text>
      );
    case 'numbered':
      return (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Text variant="bodyStrong" color="accent" style={[body, { width: 22 }]}>
            {block.n}.
          </Text>
          <Text style={[body, { flex: 1 }]}>{named(block.text)}</Text>
        </View>
      );
    case 'bullet':
      return (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              marginTop: (LINE - 6) / 2,
              marginRight: 4,
              backgroundColor: theme.accent.text,
            }}
          />
          <Text style={[body, { flex: 1 }]}>
            {block.lead ? (
              <Text variant="bodyStrong" style={body}>
                {named(block.lead)}{' '}
              </Text>
            ) : null}
            {named(block.text)}
          </Text>
        </View>
      );
    case 'paragraph':
      return (
        <Text style={body}>
          {block.lead ? (
            <Text variant="bodyStrong" style={body}>
              {named(block.lead)}{' '}
            </Text>
          ) : null}
          {named(block.text)}
        </Text>
      );
    default:
      return null;
  }
}

/**
 * Terms, the privacy policy and the attributions as something you can read: a card per section
 * under a condensed heading, loose line height, and the team colour on the list marks.
 */
export function LegalText({ md }: { md: string }) {
  const theme = useTheme();
  const { notes, sections } = legalSections(md);
  return (
    <View>
      {notes.map((note, i) => (
        <Text key={i} variant="caption" color="muted" style={{ marginBottom: theme.spacing.md }}>
          {named(note)}
        </Text>
      ))}
      {sections.map((section, i) => (
        <View key={i} style={{ marginBottom: theme.spacing.sm }}>
          {section.title ? <SectionHeader title={named(section.title)} /> : null}
          {section.blocks.length ? (
            <Card>
              <View style={{ gap: theme.spacing.md }}>
                {section.blocks.map((block, j) => (
                  <BlockText key={j} block={block} />
                ))}
              </View>
            </Card>
          ) : null}
        </View>
      ))}
    </View>
  );
}
