import { calculateEwma } from './metrics';
import { BehaviourInfo } from './types';

export function computeCredibility(
  info: BehaviourInfo,
  trace?: Map<string, number>,
): number {
  const rules = new Map<string, (info: BehaviourInfo) => number>();
  let score: number = 100;

  rules.set(
    'unrealisticMovementCountPenalty',
    evalUnrealisticMovementCountPenalty,
  );
  rules.set(
    'unrealisticRegistrationBehaviourPenalty',
    evalUnrealisticRegistrationBehaviourPenalty,
  );
  rules.set(
    'unrealisticVotingBehaviourPenalty',
    evalUnrealisticVotingBehaviourPenalty,
  );
  rules.set('identityAgePenalty', evalIdentityAgePenalty);
  rules.set('registrationAbusePenalty', evalRegistrationAbusePenalty);
  rules.set('votingAbusePenalty', evalVotingAbusePenalty);
  rules.set('interactionFrequencyPenalty', evalInteractionFrequencyPenalty);
  rules.set('votingBiasPenalty', evalVotingBiasPenalty);
  rules.set(
    'voteRegistrationRatioBiasPenalty',
    evalVoteRegistrationRatioBiasPenalty,
  );

  for (const [ruleName, rule] of rules) {
    const delta = rule(info);
    score += delta;

    if (trace) {
      trace.set(ruleName, delta);
    }
  }

  // Normalize final score between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Smoothes the score to reduce the impact of outliers
  if (info.credibility > 0) {
    score = Math.round(calculateEwma(score, info.credibility, 0.4));
  }

  return score;
}

/**
 * Calculates the penalty for the number of unrealistic movement counts.
 *
 * @param info The behavioral information.
 * @returns The penalty score.
 */
export function evalUnrealisticMovementCountPenalty(info: BehaviourInfo) {
  const MAX_PENALTY = 50;
  const count = info.unrealisticMovementCount;

  if (count <= 0) return 0;

  const penalty = Math.round(Math.exp(count) + 5);

  return -Math.min(penalty, MAX_PENALTY);
}

/**
 * Calculates the penalty for the number of unrealistic average registration counts.
 * Basically, the function checks if the average number of registrations per day is
 * reasonable.
 *
 * @param info The behavioral information.
 * @returns The penalty score.
 */
export function evalUnrealisticRegistrationBehaviourPenalty(
  info: BehaviourInfo,
) {
  const MAX_PENALTY = 20;

  const issuedNDaysAgo = Math.max(
    (Date.now() - info.issuedAt?.getTime?.()) / (1000 * 60 * 60 * 24),
    1,
  );

  const averageRegistrationsPerDay =
    info.registration.totalCount / issuedNDaysAgo;

  if (averageRegistrationsPerDay <= 0) return 0;

  const penalty = 20 - Math.exp(-(averageRegistrationsPerDay - 12) / 4);

  return -Math.min(penalty, MAX_PENALTY);
}

/**
 * Calculates the penalty for the number of unrealistic average voting counts.
 * Basically, the function checks if the average number of votes per day is
 * reasonable.
 *
 * @param info The behavioral information.
 * @returns The penalty score.
 */
export function evalUnrealisticVotingBehaviourPenalty(info: BehaviourInfo) {
  const MAX_PENALTY = 20;

  const issuedNDaysAgo = Math.max(
    (Date.now() - info.issuedAt?.getTime?.()) / (1000 * 60 * 60 * 24),
    1,
  );

  const averageVotesPerDay = info.voting.totalCount / issuedNDaysAgo;

  if (averageVotesPerDay <= 0) return 0;

  const penalty = 20 - Math.exp(-(averageVotesPerDay - 30) / 10);

  return -Math.min(penalty, MAX_PENALTY);
}

/**
 * Calculates the penalty for the age of the identity. Younger identities are
 * penalized more heavily because they are more unlikely to be trusted.
 *
 * @param info The behavioral information.
 * @returns The penalty score.
 */
export function evalIdentityAgePenalty(info: BehaviourInfo) {
  const MAX_PENALTY = 20;

  const issuedNDaysAgo = Math.max(
    (Date.now() - info.issuedAt?.getTime?.()) / (1000 * 60 * 60 * 24),
    1,
  );

  if (issuedNDaysAgo < 0) return 0;

  const penalty = -8 * Math.log10(1 + Math.exp(issuedNDaysAgo * 0.5)) + 20;

  return -Math.min(penalty, MAX_PENALTY);
}

/**
 * Calculates the penalty for voting bias.
 *
 * @param info The behavioral information.
 * @returns The penalty score.
 */
export function evalVotingBiasPenalty(info: BehaviourInfo) {
  const MAX_PENALTY = 20;

  if (info.voting.totalCount < 5) return 0;

  const ratio = info.voting.upvoteCount / info.voting.totalCount;
  const bias = Math.abs(0.5 - ratio);

  return -Math.round(Math.pow(bias * 2, 2) * MAX_PENALTY);
}

/**
 * Calculates the penalty for no votes. It checks if the identity has few votes
 * compared to the number of registrations.
 *
 * @param info The behavioral information.
 * @returns The penalty score.
 */
export function evalVoteRegistrationRatioBiasPenalty(info: BehaviourInfo) {
  const MAX_PENALTY = 20;

  if (info.voting.totalCount < 5 && info.registration.totalCount < 5) return 0;

  const ratio = info.voting.totalCount / info.registration.totalCount;
  const idealRatio = 0.75;

  const bias =
    ratio < idealRatio
      ? (idealRatio - ratio) * 2 // higher penalty, if less votes than expected
      : ratio - idealRatio; // lower penalty, if more votes than expected

  return -Math.min(Math.round(Math.pow(bias, 2)), MAX_PENALTY);
}

/**
 * Calculates the penalty for too frequent interactions. The average time between interactions
 * is used to determine the severity of the penalty.
 *
 * @param info The behavioral information.
 * @returns The penalty score.
 */
export function evalInteractionFrequencyPenalty(info: BehaviourInfo) {
  const MAX_PENALTY = 25;
  const INTERVAL_LIMIT = 5 * 60 * 1000; // 5 minutes

  const identityAgeMinutes = (Date.now() - info.issuedAt.getTime()) / 1000 / 60;

  /*
   * Using logistic growth, the penalty is weighted with the age of the identity
   * in order not to unnecessarily penalize new identities for shorter interaction
   * intervals.
   *
   * The logistic function starts near 0 for very new identities, gradually increases,
   * and approaches 1 as the identity gets older. This ensures that penalties for
   * suspicious behavior (like rapid interactions) are minimal during the early phase
   * of an identity's lifetime.
   *
   * The constant 5 represents the inflection point of the curve (in minutes),
   * where the logistic weight is 0.5 — meaning the penalty is applied at half strength
   * when the identity is 10 minutes old. After that, the penalty impact grows rapidly.
   */

  const logisticWeight = 1 / (1 + Math.exp(-0.2 * (identityAgeMinutes - 5)));

  const penalty = penaltyForAverageInterval(
    info.averageInteractionInterval,
    info.voting.totalCount + info.registration.totalCount,
    INTERVAL_LIMIT,
    MAX_PENALTY,
  );

  return -Math.round(logisticWeight * penalty);
}

/**
 * Calculates the penalty for too frequent registering. The average time between registrations
 * is used to determine the severity of the penalty.
 *
 * @param info The behavioral information.
 * @returns The penalty score.
 */
export function evalRegistrationAbusePenalty(info: BehaviourInfo) {
  const MAX_PENALTY = 20;
  const INTERVAL_LIMIT = 5 * 60 * 1000; // 5 minutes

  const identityAgeMinutes = (Date.now() - info.issuedAt.getTime()) / 1000 / 60;

  /*
   * Using logistic growth, the penalty is weighted with the age of the identity
   * in order not to unnecessarily penalize new identities for shorter interaction
   * intervals.
   *
   * The logistic function starts near 0 for very new identities, gradually increases,
   * and approaches 1 as the identity gets older. This ensures that penalties for
   * suspicious behavior (like rapid interactions) are minimal during the early phase
   * of an identity's lifetime.
   *
   * The constant 5 represents the inflection point of the curve (in minutes),
   * where the logistic weight is 0.5 — meaning the penalty is applied at half strength
   * when the identity is 10 minutes old. After that, the penalty impact grows rapidly.
   */

  const logisticWeight = 1 / (1 + Math.exp(-0.2 * (identityAgeMinutes - 5)));

  const penalty = penaltyForAverageInterval(
    info.registration.averageRegistrationInterval,
    info.registration.totalCount,
    INTERVAL_LIMIT,
    MAX_PENALTY,
  );

  return -Math.round(logisticWeight * penalty);
}

/**
 * Calculates the penalty for too frequent voting. The average time between votes
 * is used to determine the severity of the penalty.
 *
 * @param info The behavioral information.
 * @returns The penalty score.
 */
export function evalVotingAbusePenalty(info: BehaviourInfo) {
  const MAX_PENALTY = 20;
  const INTERVAL_LIMIT = 5 * 60 * 1000; // 5 minutes

  const identityAgeMinutes = (Date.now() - info.issuedAt.getTime()) / 1000 / 60;

  /*
   * Using logistic growth, the penalty is weighted with the age of the identity
   * in order not to unnecessarily penalize new identities for shorter interaction
   * intervals.
   *
   * The logistic function starts near 0 for very new identities, gradually increases,
   * and approaches 1 as the identity gets older. This ensures that penalties for
   * suspicious behavior (like rapid interactions) are minimal during the early phase
   * of an identity's lifetime.
   *
   * The constant 5 represents the inflection point of the curve (in minutes),
   * where the logistic weight is 0.5 — meaning the penalty is applied at half strength
   * when the identity is 10 minutes old. After that, the penalty impact grows rapidly.
   */

  const logisticWeight = 1 / (1 + Math.exp(-0.2 * (identityAgeMinutes - 5)));

  const penalty = penaltyForAverageInterval(
    info.voting.averageVotingInterval,
    info.voting.totalCount,
    INTERVAL_LIMIT,
    MAX_PENALTY,
  );

  return -Math.round(logisticWeight * penalty);
}

/**
 * Calculates a behavioral penalty based on how frequently a user interacts.
 *
 * The penalty increases when the average interaction interval is shorter than a defined minimum.
 * It is scaled logarithmically by the number of interactions to ensure more reliable patterns
 * receive stronger penalties, and avoids penalizing users with too few interactions.
 *
 * @param interval - Average time between interactions.
 * @param count - Total number of interactions recorded.
 * @param minInterval - Minimum reasonable interval between actions before it is considered suspicious.
 * @param penaltyCap - Maximum possible penalty.
 * @returns A penalty score between 0 and `penaltyCap`.
 */
function penaltyForAverageInterval(
  interval: number,
  count: number,
  minInterval: number,
  penaltyCap: number,
): number {
  // Avoid penalizing users with too few data points (unreliable pattern)
  if (count < 5) return 0;

  /*
   * Determine severity based on how much the average interval falls below the minimum.
   * If interval >= minInterval, severity is 0 (no penalty); if interval is very short,
   * severity approaches 1.
   */
  const severity = Math.max(0, 1 - interval / minInterval);

  /*
   * Logarithmic scaling: more interactions strengthen the confidence in the user's
   * behavior pattern. Scales from 0 to 1, capping at 50 interactions.
   */
  const scaling = Math.min(1, Math.log(count + 1) / Math.log(100));

  // Final penalty is a product of severity, scaling, and the configured penalty cap
  return Math.round(penaltyCap * severity * scaling);
}
