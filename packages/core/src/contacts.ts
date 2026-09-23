/**
 * Contacts matching, the phone's half (social brief 02, section 5).
 *
 * The phone reads its address book, normalizes each email and phone number exactly the way
 * the server normalizes an account's own (`contact_normalize_email`, `contact_normalize_phone`
 * in supabase/migrations/20260924010200_contacts.sql), hashes each one with the server's salt,
 * and sends only the hashes. Nothing here does I/O: the reader and the hasher are passed in, so
 * a test can see exactly what would leave the phone.
 */

export type ContactIdentifierKind = 'email' | 'phone';

export type RawContact = {
  id: string;
  name: string;
  emails: readonly string[];
  phones: readonly string[];
};

export function normalizeEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : null;
}

/** Digits only; ten digits gain the North American country code; under seven is not a number. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `1${digits}`;
  return digits.length >= 7 ? digits : null;
}

/** What gets hashed: the salt, the kind and the value, colon separated. */
export function contactHashInput(salt: string, kind: ContactIdentifierKind, value: string): string {
  return `${salt}:${kind}:${value}`;
}

export type HashedContacts = {
  /** Every distinct hash, the only thing sent to the server. */
  hashes: string[];
  /** Which contact each hash came from, kept on the phone to name the matches. */
  owners: Map<string, string>;
};

/**
 * Normalizes and hashes a whole address book. `sha256Hex` is expo-crypto on the phone and
 * node:crypto in tests. A contact with nothing usable contributes nothing.
 */
export async function hashContacts(
  contacts: readonly RawContact[],
  salt: string,
  sha256Hex: (input: string) => Promise<string>,
): Promise<HashedContacts> {
  const owners = new Map<string, string>();
  for (const c of contacts) {
    const values: [ContactIdentifierKind, string | null][] = [
      ...c.emails.map((e): [ContactIdentifierKind, string | null] => ['email', normalizeEmail(e)]),
      ...c.phones.map((p): [ContactIdentifierKind, string | null] => ['phone', normalizePhone(p)]),
    ];
    for (const [kind, value] of values) {
      if (value === null) continue;
      const hash = (await sha256Hex(contactHashInput(salt, kind, value))).toLowerCase();
      if (!owners.has(hash)) owners.set(hash, c.id);
    }
  }
  return { hashes: [...owners.keys()], owners };
}

/** The server takes at most this many hashes a call (`match_contacts`). */
export const CONTACT_MATCH_BATCH = 2000;

export function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
