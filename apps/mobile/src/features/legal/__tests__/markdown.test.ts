import { parseMarkdownLite } from '../MarkdownLite';
import { ATTRIBUTION_MD, PRIVACY_MD, TERMS_MD } from '../text';

describe('parseMarkdownLite', () => {
  it('splits the docs copy into headings, notes, bullets, numbered items and paragraphs', () => {
    const attribution = parseMarkdownLite(ATTRIBUTION_MD);
    expect(attribution[0]).toEqual({
      type: 'heading',
      text: 'Data attribution (shown on the About screen)',
    });
    expect(attribution[1]).toMatchObject({ type: 'paragraph', lead: 'MLB game data' });

    const terms = parseMarkdownLite(TERMS_MD);
    expect(terms.find((b) => b.type === 'note')?.type).toBe('note');
    expect(terms.filter((b) => b.type === 'numbered')).toHaveLength(7);

    const privacy = parseMarkdownLite(PRIVACY_MD);
    expect(privacy.some((b) => b.type === 'bullet' && b.text.startsWith('Check-ins'))).toBe(true);
    expect(privacy.some((b) => b.type === 'paragraph' && b.lead === 'What we collect')).toBe(true);
  });
});
