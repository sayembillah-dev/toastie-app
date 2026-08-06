/** Stand-ins for auth, same idea as `CURRENT_MEMBER_ID` in `lib/me`. There is
 * no sign-in flow yet, so the District/Division/Area dashboards always act as
 * whichever officer serves these particular units — swapping these constants
 * for a real session lookup is the only change needed once auth exists. */
export const CURRENT_DISTRICT_ID = 'dist-88';
export const CURRENT_DIVISION_ID = 'div-a';
export const CURRENT_AREA_ID = 'area-a1';
