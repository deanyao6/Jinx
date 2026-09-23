import { batches, CONTACT_MATCH_BATCH, hashContacts, type RawContact } from '@jinx/core';
import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

/**
 * Finding people you know from your contacts (social brief 02, section 5).
 *
 * On the phone: read the address book, normalize and hash every email and number with the
 * server's salt (packages/core/src/contacts.ts). To the server: hashes only, never a name, an
 * email or a number. From the server: which hashes belong to accounts. The address book itself
 * never leaves the phone and nothing about it is stored, here or there.
 */

export type ContactMatch = {
  userId: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  isPrivate: boolean;
  followStatus: 'active' | 'requested' | null;
  /** The name this fan has them saved under, from the phone. */
  contactName: string;
};

export type ContactInvite = { id: string; name: string };

export type ContactsResult = {
  matches: ContactMatch[];
  /** Contacts with no account, to invite. */
  invites: ContactInvite[];
};

/** What leaves the phone, in one place so a test can check it: the RPC name and its args. */
export type MatchCall = (hashes: string[]) => Promise<
  {
    hash: string;
    user_id: string;
    handle: string;
    display_name: string;
    avatar_path: string | null;
    is_private: boolean;
    follow_status: string | null;
  }[]
>;

export async function matchContacts(
  contacts: readonly RawContact[],
  deps: {
    salt: () => Promise<string>;
    sha256Hex: (input: string) => Promise<string>;
    call: MatchCall;
  },
): Promise<ContactsResult> {
  const salt = await deps.salt();
  const { hashes, owners } = await hashContacts(contacts, salt, deps.sha256Hex);
  const byContact = new Map(contacts.map((c) => [c.id, c]));
  const matches = new Map<string, ContactMatch>();
  const matchedContacts = new Set<string>();
  for (const batch of batches(hashes, CONTACT_MATCH_BATCH)) {
    for (const row of await deps.call(batch)) {
      const contactId = owners.get(row.hash);
      if (contactId) matchedContacts.add(contactId);
      if (matches.has(row.user_id)) continue;
      matches.set(row.user_id, {
        userId: row.user_id,
        handle: row.handle,
        displayName: row.display_name,
        avatarPath: row.avatar_path,
        isPrivate: row.is_private,
        followStatus: row.follow_status === 'active' || row.follow_status === 'requested' ? row.follow_status : null,
        contactName: (contactId && byContact.get(contactId)?.name) || row.display_name || row.handle,
      });
    }
  }
  const invites = contacts
    .filter((c) => !matchedContacts.has(c.id) && c.name.trim())
    .map((c) => ({ id: c.id, name: c.name.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { matches: [...matches.values()], invites };
}

/** The phone's own implementation: expo-crypto for the hash, the RPC for the match. */
export const phoneDeps = {
  salt: async () => {
    const { data, error } = await supabase.rpc('contact_salt');
    if (error) throw error;
    if (!data) throw new Error('No salt');
    return data;
  },
  sha256Hex: (input: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input),
  call: (async (hashes: string[]) => {
    const { data, error } = await supabase.rpc('match_contacts', { p_hashes: hashes });
    if (error) throw error;
    return data;
  }) satisfies MatchCall,
};

export type ReadOutcome = { status: 'granted'; contacts: RawContact[] } | { status: 'denied' };

/** Asks for permission (the system prompt fires here, after our own explanation) and reads. */
export async function readContacts(): Promise<ReadOutcome> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return { status: 'denied' };
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
  });
  return {
    status: 'granted',
    contacts: data.map((c) => ({
      id: c.id ?? `${c.name}-${Math.random()}`,
      name: c.name ?? [c.firstName, c.lastName].filter(Boolean).join(' '),
      emails: (c.emails ?? []).map((e) => e.email ?? '').filter(Boolean),
      phones: (c.phoneNumbers ?? []).map((p) => p.number ?? p.digits ?? '').filter(Boolean),
    })),
  };
}

/** Marks the contacts step as answered, so onboarding offers it once. */
export async function markContactsPrompted(userId: string): Promise<void> {
  await supabase.from('profiles').update({ contacts_prompted_at: new Date().toISOString() }).eq('id', userId);
}
