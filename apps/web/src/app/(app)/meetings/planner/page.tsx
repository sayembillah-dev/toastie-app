import { PlannerScreen } from '@/components/meetings/planner-screen';
import { AccessGate } from '@/components/permissions/access-gate';

/** `/meetings/planner` — static segment, so it wins over `[meetingId]`.
 * Gated on `meeting` like the rest of the section; the grid inside still
 * greys its own write affordances for anyone the planner-rows API would
 * reject. */
export default function MeetingsPlannerPage() {
  return (
    <AccessGate resource="meeting">
      <PlannerScreen />
    </AccessGate>
  );
}
