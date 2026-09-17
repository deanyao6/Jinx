import React from 'react';

import { PersonAvatar } from '@/components/PersonAvatar';
import { Avatar } from '@/components/reference/Avatar';

import type { PersonRef } from './shapes';

type Props = {
  /** The avatar key from a fixture: a fixture name in demo mode, a person or user id otherwise. */
  who: string;
  /** `repository.person(who)`: null means the key names fixture art. */
  person: PersonRef | null;
  size: number;
};

/**
 * An avatar on a reference screen, where people arrive as bare keys (SPEC.md 8.6, 8.9).
 *
 * In demo mode a key names one of the reference's six drawn faces, and those are drawn exactly
 * as before so `npm run parity` still compares like with like. Against real data a key is a
 * person, and they get their photo or their own generated default.
 *
 * The screen resolves the person and passes it in. Reading the repository here instead would
 * subscribe every avatar in a list to every query the repository is built from.
 */
export function RepositoryAvatar({ who, person, size }: Props) {
  if (!person) return <Avatar name={who} size={size} />;
  return (
    <PersonAvatar
      userId={person.userId ?? who}
      name={person.name}
      handle={person.handle}
      path={person.avatarPath}
      size={size}
    />
  );
}
