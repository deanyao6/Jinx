import { isLocalHost } from '../env';

/**
 * The guard that stops a release build shipping with the development backend baked in.
 *
 * EXPO_PUBLIC_* values are inlined at build time, so a TestFlight build made while `.env`
 * still says `http://127.0.0.1:54421` installs, launches, and then fails every request on a
 * device where no such host exists. Nothing on screen explains it. This is the check that
 * turns that into a message.
 */
describe('isLocalHost', () => {
  it('catches the local Supabase stack this repo develops against', () => {
    expect(isLocalHost('http://127.0.0.1:54421')).toBe(true);
    expect(isLocalHost('http://localhost:54421')).toBe(true);
  });

  it('catches a LAN address, which works over wifi but not from TestFlight', () => {
    // The tempting workaround: point the phone at the laptop. It works on the sofa and
    // nowhere else, so a release build must not carry one.
    expect(isLocalHost('http://192.168.1.14:54421')).toBe(true);
    expect(isLocalHost('http://10.0.0.5:54421')).toBe(true);
    expect(isLocalHost('http://172.16.4.2:54421')).toBe(true);
    expect(isLocalHost('http://172.31.255.1:54421')).toBe(true);
    expect(isLocalHost('http://deans-macbook.local:54421')).toBe(true);
  });

  it('does not mistake a public address for a private one', () => {
    expect(isLocalHost('https://vekdufflzklfxljqufbq.supabase.co')).toBe(false);
    // 172.15 and 172.32 are outside the private block; only 172.16 to 172.31 are private.
    expect(isLocalHost('http://172.15.0.1')).toBe(false);
    expect(isLocalHost('http://172.32.0.1')).toBe(false);
    // A public host that merely starts with the same digits.
    expect(isLocalHost('https://10keeper.example.com')).toBe(false);
    expect(isLocalHost('https://jinx.app')).toBe(false);
  });

  it('reads the host out of a URL with a path or no scheme', () => {
    expect(isLocalHost('http://127.0.0.1:54421/rest/v1')).toBe(true);
    expect(isLocalHost('127.0.0.1:54421')).toBe(true);
  });
});
