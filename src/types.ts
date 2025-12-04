export interface BehaviourInfo {
  /**
   * The previous credibility of the user. It is a number between 0 and 100.
   * The higher the number, the more credible the user is.
   */
  credibility: number;

  /**
   * The time when the user was registered or the identity was issued.
   */
  issuedAt: Date;

  /**
   * The last time the user interacted with the platform.
   */
  lastInteractionAt?: Date;

  /**
   * The average time between interactions.
   */
  averageInteractionInterval: number;

  /**
   * The last known position of the user.
   */
  lastInteractionPosition?: { longitude: number; latitude: number };

  /**
   * The score is a number between 0 and 1. 0 means no unrealistically movement,
   * 1 means very unrealistically movement
   */
  unrealisticMovementScore: number;

  /**
   * Common information about the user's voting behaviour.
   */
  voting: {
    totalCount: number;
    upvoteCount: number;
    downvoteCount: number;
    lastVotedAt?: Date;
    averageVotingInterval: number;
  };

  /**
   * Common information about the user's registration behaviour.
   */
  registration: {
    totalCount: number;
    lastRegistrationAt?: Date;
    averageRegistrationInterval: number;
  };
}
