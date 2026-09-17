import { emailSignInEnabled, forwardingEnabled } from '../env';

describe('forwardingEnabled', () => {
  it('is off for the placeholder domain the builds ship with today', () => {
    expect(forwardingEnabled('in.example.com')).toBe(false);
    expect(forwardingEnabled('example.com')).toBe(false);
    expect(forwardingEnabled('IN.EXAMPLE.COM ')).toBe(false);
  });

  it('is off when nothing usable is configured', () => {
    expect(forwardingEnabled(undefined)).toBe(false);
    expect(forwardingEnabled('')).toBe(false);
    expect(forwardingEnabled('localhost')).toBe(false);
  });

  it('turns on by itself the day a real domain is configured', () => {
    expect(forwardingEnabled('in.jinx.fan')).toBe(true);
  });

  it('does not mistake a real domain that merely contains the word', () => {
    expect(forwardingEnabled('in.myexample.com')).toBe(true);
  });
});

describe('emailSignInEnabled', () => {
  it('is hidden in a release build, where no code would ever be sent', () => {
    expect(emailSignInEnabled(undefined, false)).toBe(false);
    expect(emailSignInEnabled('', false)).toBe(false);
    expect(emailSignInEnabled('0', false)).toBe(false);
  });

  it('is one environment variable away once a sender exists', () => {
    expect(emailSignInEnabled('1', false)).toBe(true);
    expect(emailSignInEnabled('true', false)).toBe(true);
  });

  it('is always offered in development, where the simulator cannot use Sign in with Apple', () => {
    expect(emailSignInEnabled(undefined, true)).toBe(true);
  });
});
