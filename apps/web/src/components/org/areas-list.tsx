'use client';

import { MapPin } from '@phosphor-icons/react/dist/ssr';
import { useState } from 'react';

import type { Area } from '@/lib/org/types';
import { useListAreasQuery, useUpdateAreaMutation } from '@/store/api';

import { AreaModal } from './area-modal';
import { MoveModal } from './move-modal';
import type { OrgCardAction } from './org-card';
import { OrgCard } from './org-card';
import { OrgListSection } from './org-list-section';

interface AreasListProps {
  title: string;
  subtitle?: string;
  /** Parent to list areas for, and to create new areas under. */
  divisionId: string;
  /** Builds the drill-down link for a given area — differs per dashboard
   * (`/district/[divisionId]/[areaId]`, `/division/[areaId]`, or the Super
   * Admin equivalent). */
  hrefFor: (area: Area) => string;
  /** Only Super Admin can delete an area or move it to a different
   * division — District and Division can create/rename their own. */
  canDelete: boolean;
  canMove: boolean;
  moveOptions: { value: string; label: string }[];
}

/** Areas inside one division — the middle drill-down level for District and
 * the home page for the Division dashboard. */
export function AreasList({
  title,
  subtitle,
  divisionId,
  hrefFor,
  canDelete,
  canMove,
  moveOptions,
}: AreasListProps) {
  const { data: areas, isLoading, isError, error, refetch } = useListAreasQuery(divisionId);
  const [updateArea] = useUpdateAreaMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [movingArea, setMovingArea] = useState<Area | null>(null);

  return (
    <>
      <OrgListSection
        title={title}
        subtitle={subtitle}
        items={areas}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        getKey={(area) => area.id}
        addLabel="Add area"
        onAdd={() => setAddOpen(true)}
        emptyIcon={MapPin}
        emptyTitle="No areas yet."
        emptyDescription="Add the areas that belong to this division."
        renderCard={(area) => {
          const actions: OrgCardAction[] = [
            { key: 'edit', label: 'Edit', onClick: () => setEditingArea(area) },
          ];
          if (canMove) {
            actions.push({
              key: 'move',
              label: 'Move to a different division',
              onClick: () => setMovingArea(area),
            });
          }
          return <OrgCard Icon={MapPin} title={area.name} href={hrefFor(area)} actions={actions} />;
        }}
      />

      <AreaModal
        open={addOpen}
        divisionId={divisionId}
        area={null}
        canDelete={canDelete}
        onClose={() => setAddOpen(false)}
      />
      <AreaModal
        open={editingArea !== null}
        divisionId={divisionId}
        area={editingArea}
        canDelete={canDelete}
        onClose={() => setEditingArea(null)}
      />
      {movingArea ? (
        <MoveModal
          open={movingArea !== null}
          title={`Move ${movingArea.name}`}
          fieldLabel="New division"
          currentParentId={movingArea.divisionId}
          options={moveOptions}
          onMove={async (targetId) => {
            await updateArea({ areaId: movingArea.id, divisionId: targetId }).unwrap();
          }}
          onClose={() => setMovingArea(null)}
        />
      ) : null}
    </>
  );
}
