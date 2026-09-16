import type { Href, useRouter } from 'expo-router';

import type { ShareTemplate } from './types';

/** Route for the share sheet with the template encoded in the params. */
export function shareHref(template: ShareTemplate): Href {
  return {
    pathname: '/share/[template]',
    params: { template: template.kind, payload: JSON.stringify(template) },
  } as Href;
}

export function openShare(router: ReturnType<typeof useRouter>, template: ShareTemplate): void {
  router.push(shareHref(template));
}
