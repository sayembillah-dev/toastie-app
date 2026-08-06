'use client';

import { Compass } from '@phosphor-icons/react/dist/ssr';
import { useState } from 'react';

import type { Division } from '@/lib/org/types';
import { useListDivisionsQuery, useUpdateDivisionMutation } from '@/store/api';

import { DivisionModal } from './division-modal';
import { MoveModal } from './move-modal';
import type { OrgCardAction } from './org-card';
import { OrgCard } from './org-card';
import { OrgListSection } from './org-list-section';

interface DivisionsListProps {
  title: string;
  subtitle?: string;
  /** Parent to list divisions for, and to create new divisions under. */
  districtId: string;
  /** Builds the drill-down link for a given division — differs per
   * dashboard (`/district/[divisionId]` or the Super Admin equivalent). */
  hrefFor: (division: Division) => string;
  /** Only Super Admin can delete a division or move it to a different
   * district — District can create/rename its own. */
  canDelete: boolean;
  canMove: boolean;
  moveOptions: { value: string; label: string }[];
}

/** Divisions inside one district — the District dashboard's home page and
 * Super Admin's second drill-down level. */
export function DivisionsList({
  title,
  subtitle,
  districtId,
  hrefFor,
  canDelete,
  canMove,
  moveOptions,
}: DivisionsListProps) {
  const { data: divisions, isLoading, isError, error, refetch } = useListDivisionsQuery(districtId);
  const [updateDivision] = useUpdateDivisionMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [movingDivision, setMovingDivision] = useState<Division | null>(null);

  return (
    <>
      <OrgListSection
        title={title}
        subtitle={subtitle}
        items={divisions}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        getKey={(division) => division.id}
        addLabel="Add division"
        onAdd={() => setAddOpen(true)}
        emptyIcon={Compass}
        emptyTitle="No divisions yet."
        emptyDescription="Add the divisions that belong to this district."
        renderCard={(division) => {
          const actions: OrgCardAction[] = [
            { key: 'edit', label: 'Edit', onClick: () => setEditingDivision(division) },
          ];
          if (canMove) {
            actions.push({
              key: 'move',
              label: 'Move to a different district',
              onClick: () => setMovingDivision(division),
            });
          }
          return (
            <OrgCard
              Icon={Compass}
              title={division.name}
              href={hrefFor(division)}
              actions={actions}
            />
          );
        }}
      />

      <DivisionModal
        open={addOpen}
        districtId={districtId}
        division={null}
        canDelete={canDelete}
        onClose={() => setAddOpen(false)}
      />
      <DivisionModal
        open={editingDivision !== null}
        districtId={districtId}
        division={editingDivision}
        canDelete={canDelete}
        onClose={() => setEditingDivision(null)}
      />
      {movingDivision ? (
        <MoveModal
          open={movingDivision !== null}
          title={`Move ${movingDivision.name}`}
          fieldLabel="New district"
          currentParentId={movingDivision.districtId}
          options={moveOptions}
          onMove={async (targetId) => {
            await updateDivision({ divisionId: movingDivision.id, districtId: targetId }).unwrap();
          }}
          onClose={() => setMovingDivision(null)}
        />
      ) : null}
    </>
  );
}
