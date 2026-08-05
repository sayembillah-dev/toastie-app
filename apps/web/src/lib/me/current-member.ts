/** Stand-in for auth. There is no sign-in flow yet, so the Me page always
 * renders this member's data — swapping this constant for a real session
 * lookup is the only change needed once auth exists. Picked for the richest
 * seed history (`HISTORY_SEED['m-01']`) so every card on the page has
 * something real to show. */
export const CURRENT_MEMBER_ID = 'm-01';
