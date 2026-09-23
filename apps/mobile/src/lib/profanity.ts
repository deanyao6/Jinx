/**
 * The profanity filter for handles and display names (SPEC.md Section 11). It lives in
 * packages/core now, one list shared with the comment warning and mirrored by the database
 * (`contains_profanity`), so the three can never disagree.
 */
export { containsProfanity, normalizeForProfanity, PROFANITY_WORD_COUNT } from '@jinx/core';
