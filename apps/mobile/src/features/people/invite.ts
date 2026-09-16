import { Share } from 'react-native';

/** Deep link scheme from app.json (`scheme`). APPNAME is a placeholder name. */
export const APP_SCHEME = 'appname';

export function inviteUrl(token: string): string {
  return `${APP_SCHEME}://invite/${encodeURIComponent(token)}`;
}

export function inviteMessage(personName: string, token: string): string {
  return `I tagged you as “${personName}” on my APPNAME passport. Open this link in the app to link up: ${inviteUrl(token)}`;
}

/** Placeholder until the TestFlight link exists. */
export const APP_DOWNLOAD_TEXT =
  'Join me on APPNAME, a passport for the games we go to. TestFlight link coming soon.';

export async function shareInvite(personName: string, token: string): Promise<void> {
  await Share.share({ message: inviteMessage(personName, token), url: inviteUrl(token) });
}

export async function shareAppLink(): Promise<void> {
  await Share.share({ message: APP_DOWNLOAD_TEXT });
}
