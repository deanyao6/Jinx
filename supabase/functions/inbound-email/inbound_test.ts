import { assertEquals } from 'jsr:@std/assert@1';

import { extractAddress, htmlToText, tokenFromAddress } from './index.ts';

Deno.test('extractAddress handles display names', () => {
  assertEquals(extractAddress('Dean Yao <Dean@Example.com>'), 'dean@example.com');
  assertEquals(extractAddress('dean@example.com'), 'dean@example.com');
});

Deno.test('tokenFromAddress parses the forwarding address', () => {
  assertEquals(tokenFromAddress('u-abc123def456@in.example.com'), 'abc123def456');
  assertEquals(tokenFromAddress('hello@in.example.com'), null);
});

Deno.test('htmlToText strips tags and entities', () => {
  const t = htmlToText(
    '<div><p>Phillies vs Mets</p><br><span>Sec 121 &amp; Row 14</span><style>.x{}</style></div>',
  );
  assertEquals(t, 'Phillies vs Mets\nSec 121 & Row 14');
});
