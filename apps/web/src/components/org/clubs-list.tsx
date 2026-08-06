'use client';

import { Buildings } from '@phosphor-icons/react/dist/ssr';
import { useState } from 'react';
import type { OrgClub } from '@/lib/org/types';
import { ORG_CLUB_STATUS_LABELS } from '@/lib/org/types';
import { useListOrgClubsQuery, useUpdateOrgClubMutation } from '@/store/api';

import { MoveModal } from './move-modal';
import type { OrgCardAction } from './org-card';
import { OrgCard } from './org-card';
import { OrgClubModal } from './org-club-modal';
import { OrgListSection } from './org-list-section';

interface ClubsListProps {
  title: string;
  subtitle?: string;
  /** Parent to list clubs for, and to create new clubs under. */
  areaId: string;
  /** Only Super Admin can delete a club outright. */
  canDelete: boolean;
  /** Areas a club here can be moved to — scoped by the caller to whatever
   * the acting dashboard is allowed to see (its own division, its own
   * district, or everywhere for Super Admin). */
  moveOptions: { value: string; label: string }[];
}

/** The leaf level of every unit-switcher dashboard — the clubs inside one
 * area. Reused by the Area dashboard's home page, the last drill-down step
 * of District and Division, and Super Admin's deepest level. */
export function ClubsList({ title, subtitle, areaId, canDelete, moveOptions }: ClubsListProps) {
  const { data: clubs, isLoading, isError, error, refetch } = useListOrgClubsQuery(areaId);
  const [updateClub] = useUpdateOrgClubMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<OrgClub | null>(null);
  const [movingClub, setMovingClub] = useState<OrgClub | null>(null);

  return (
    <>
      <OrgListSection
        title={title}
        subtitle={subtitle}
        items={clubs}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        getKey={(club) => club.id}
        addLabel="Add club"
        onAdd={() => setAddOpen(true)}
        emptyIcon={Buildings}
        emptyTitle="No clubs yet."
        emptyDescription="Add the clubs that belong to this area."
        renderCard={(club) => {
          const actions: OrgCardAction[] = [
            { key: 'edit', label: 'Edit', onClick: () => setEditingClub(club) },
          ];
          if (moveOptions.length > 1) {
            actions.push({
              key: 'move',
              label: 'Move to a different area',
              onClick: () => setMovingClub(club),
            });
          }
          return (
            <OrgCard
              Icon={Buildings}
              title={club.name}
              subtitle={club.clubNumber ? `Club #${club.clubNumber}` : undefined}
              badge={
                club.status === 'active'
                  ? undefined
                  : {
                      label: ORG_CLUB_STATUS_LABELS[club.status],
                      tone: club.status === 'suspended' ? 'danger' : 'warning',
                    }
              }
              actions={actions}
            />
          );
        }}
      />

      <OrgClubModal
        open={addOpen}
        areaId={areaId}
        club={null}
        canDelete={canDelete}
        onClose={() => setAddOpen(false)}
      />
      <OrgClubModal
        open={editingClub !== null}
        areaId={areaId}
        club={editingClub}
        canDelete={canDelete}
        onClose={() => setEditingClub(null)}
      />
      {movingClub ? (
        <MoveModal
          open={movingClub !== null}
          title={`Move ${movingClub.name}`}
          fieldLabel="New area"
          currentParentId={movingClub.areaId}
          options={moveOptions}
          onMove={async (targetId) => {
            await updateClub({ clubId: movingClub.id, areaId: targetId }).unwrap();
          }}
          onClose={() => setMovingClub(null)}
        />
      ) : null}
    </>
  );
}
