import { matchContacts, type MatchCall } from '../contacts';

// Node's own SHA-256 under Jest; the app uses expo-crypto (the module is mocked below).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createHash } = require('crypto') as {
  createHash: (alg: string) => { update: (s: string) => { digest: (enc: 'hex') => string } };
};

jest.mock('expo-contacts', () => ({}));
jest.mock('expo-crypto', () => ({}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));


const sha256Hex = async (s: string) => createHash('sha256').update(s).digest('hex');

const addressBook = [
  { id: 'c-maya', name: 'Maya Chen', emails: ['Maya.Chen@example.com'], phones: ['(215) 555-0134'] },
  { id: 'c-dad', name: 'Dad', emails: [], phones: ['+1 610 555 0199'] },
  { id: 'c-none', name: 'No Details', emails: [], phones: [] },
];

/**
 * Social brief 02, section 9: "verify that no raw contact data hits the network (inspect the
 * request payloads in a test)". `call` is the one thing that talks to the server, so every
 * argument it receives is the whole of what leaves the phone.
 */
describe('contacts matching', () => {
  it('sends only 64-character hex hashes: no name, email, number or contact id', async () => {
    const sent: unknown[] = [];
    const call: MatchCall = async (hashes) => {
      sent.push(hashes);
      return [];
    };
    await matchContacts(addressBook, { salt: async () => 'server-salt', sha256Hex, call });
    expect(sent).toHaveLength(1);
    const payload = JSON.stringify(sent);
    expect(payload.replace(/"[0-9a-f]{64}"/g, 'H')).toBe('[[H,H,H]]');
  });

  it('names a match by the contact it came from, on the phone, and invites the rest', async () => {
    const mayaHash = await sha256Hex('server-salt:email:maya.chen@example.com');
    const call: MatchCall = async (hashes) =>
      hashes.includes(mayaHash)
        ? [
            {
              hash: mayaHash,
              user_id: 'u-maya',
              handle: 'mayachen',
              display_name: 'Maya C.',
              avatar_path: null,
              is_private: false,
              follow_status: null,
            },
          ]
        : [];
    const result = await matchContacts(addressBook, { salt: async () => 'server-salt', sha256Hex, call });
    expect(result.matches).toEqual([
      expect.objectContaining({ userId: 'u-maya', contactName: 'Maya Chen', followStatus: null }),
    ]);
    expect(result.invites.map((i) => i.name)).toEqual(['Dad', 'No Details']);
  });

  it('splits a big address book into calls of at most 2,000 hashes', async () => {
    const big = Array.from({ length: 2500 }, (_, i) => ({
      id: `c${i}`,
      name: `Person ${i}`,
      emails: [`p${i}@example.com`],
      phones: [],
    }));
    const sizes: number[] = [];
    await matchContacts(big, {
      salt: async () => 's',
      sha256Hex,
      call: async (hashes) => {
        sizes.push(hashes.length);
        return [];
      },
    });
    expect(sizes).toEqual([2000, 500]);
  });
});
