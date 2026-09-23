import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { batches, hashContacts, normalizeEmail, normalizePhone } from './contacts.js';

const sha256Hex = async (s: string) => createHash('sha256').update(s).digest('hex');

// pgTAP 073 checks the SQL normalizers against these same examples.
describe('normalizing', () => {
  it('lowercases and trims an email, and refuses what is not one', () => {
    expect(normalizeEmail('  Maya.Chen@Example.COM ')).toBe('maya.chen@example.com');
    expect(normalizeEmail('not an email')).toBeNull();
    expect(normalizeEmail('a@b')).toBeNull();
  });

  it('keeps the digits of a phone number and adds the North American country code', () => {
    expect(normalizePhone('(215) 555-0134')).toBe('12155550134');
    expect(normalizePhone('+1 215 555 0134')).toBe('12155550134');
    expect(normalizePhone('+44 20 7946 0958')).toBe('442079460958');
    expect(normalizePhone('911')).toBeNull();
  });
});

describe('hashContacts', () => {
  const contacts = [
    { id: 'c1', name: 'Maya Chen', emails: ['Maya.Chen@example.com'], phones: ['(215) 555-0134'] },
    { id: 'c2', name: 'Dad', emails: [], phones: ['215.555.0134', 'ext'] },
    { id: 'c3', name: 'Nobody', emails: ['nope'], phones: [] },
  ];

  it('sends nothing but 64-character hex hashes: no name, email, number or contact id', async () => {
    const { hashes } = await hashContacts(contacts, 'salt', sha256Hex);
    const payload = JSON.stringify({ p_hashes: hashes });
    expect(hashes).toHaveLength(2);
    for (const h of hashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    // Take the hashes out and nothing is left but the envelope. (Checking for "215" in the
    // whole payload would be wrong: a hex hash can contain it by chance.)
    expect(payload.replace(/"[0-9a-f]{64}"/g, 'H')).toBe('{"p_hashes":[H,H]}');
  });

  it('hashes the salt, the kind and the normalized value, as the server does', async () => {
    const { hashes } = await hashContacts([contacts[0]!], 'salt', sha256Hex);
    expect(hashes).toContain(await sha256Hex('salt:email:maya.chen@example.com'));
    expect(hashes).toContain(await sha256Hex('salt:phone:12155550134'));
  });

  it('remembers on the phone which contact a hash came from, first one wins', async () => {
    const { owners } = await hashContacts(contacts, 'salt', sha256Hex);
    expect(owners.get(await sha256Hex('salt:phone:12155550134'))).toBe('c1');
  });

  it('a different salt gives different hashes', async () => {
    const a = await hashContacts([contacts[0]!], 'one', sha256Hex);
    const b = await hashContacts([contacts[0]!], 'two', sha256Hex);
    expect(a.hashes.some((h) => b.hashes.includes(h))).toBe(false);
  });

  it('batches', () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
