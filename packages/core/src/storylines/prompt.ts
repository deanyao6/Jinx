/**
 * What the model is asked, and nothing it is not (SPEC 6.18).
 *
 * The prompt does one job the validator cannot: it tells the model what a good storyline IS, so
 * that most attempts pass on the first try. It is not the safety net; validate.ts is. Everything
 * the prompt forbids, the validator also rejects, so a prompt the model ignores still cannot put
 * a wrong sentence on screen.
 *
 * The facts go in as JSON, verbatim, and the instruction is to use only them. A retry carries the
 * validator's reason, which is specific ("It states 7, which is not in the facts"), because a
 * vague "try again" tends to reproduce the same mistake.
 */
import type { TeamFacts } from './facts.js';
import type { Significance } from './significance.js';

export const STORYLINE_SYSTEM = [
  'You write one-sentence pregame storylines for a sports app, from facts you are given.',
  '',
  'Rules, all of them strict:',
  '- Use only the facts in the JSON. Do not add anything you know about these teams from anywhere else.',
  '- Every number you write must appear in the facts. Write numbers as digits.',
  '- Name no players, coaches, or teams other than the ones in the facts.',
  '- Do not claim anything about clinching, elimination, playoff races, injuries, rivalries, or history.',
  '- One sentence, under 140 characters, plain and specific. No hype words.',
  '- Never use an em dash. Use a comma instead.',
  '',
  'Pick the single most interesting fact, or two that belong together, rather than listing several.',
].join('\n');

/** The request for one team's storyline. */
export function teamPrompt(facts: TeamFacts): string {
  return [
    `Write one storyline about the ${facts.team}, who ${facts.atHome ? 'host' : 'visit'} the ${facts.opponent}.`,
    '',
    'Field notes:',
    '- streak: positive is a winning streak, negative a losing streak, 0 is none.',
    '- venueRecord: their record this season at home or on the road, matching this game.',
    "- lastMeeting: the most recent game between them, from this team's side.",
    '',
    'Facts:',
    JSON.stringify(facts),
  ].join('\n');
}

/** The request for the one storyline about why the game matters. */
export function significancePrompt(sig: Significance): string {
  const what =
    sig.kind === 'postseason'
      ? `This is a postseason game, ${sig.away} at ${sig.home}.`
      : sig.kind === 'season_opener'
        ? `This is the ${sig.team}' first regular-season game of ${sig.season}.`
        : `This is the ${sig.team}' first home game of ${sig.season}.`;
  return [
    'Write one storyline about why this game matters.',
    what,
    sig.kind === 'postseason'
      ? "seriesRecordForHome, if present, is this postseason's games between them, from the home team's side."
      : '',
    '',
    'Facts:',
    JSON.stringify(sig),
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n');
}

/** A retry: the same request, plus exactly what was wrong with the last answer. */
export function retryPrompt(original: string, rejected: string, reason: string): string {
  return [
    original,
    '',
    `Your previous answer was rejected: "${rejected}"`,
    `Reason: ${reason}`,
    'Write a new one that fixes this.',
  ].join('\n');
}
