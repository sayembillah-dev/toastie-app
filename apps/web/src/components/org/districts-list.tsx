'use client';

import { Globe } from '@phosphor-icons/react/dist/ssr';
import { useState } from 'react';

import type { District } from '@/lib/org/types';
import { useListDistrictsQuery } from '@/store/api';

import { DistrictModal } from './district-modal';
import type { OrgCardAction } from './org-card';
import { OrgCard } from './org-card';
import { OrgListSection } from './org-list-section';

interface DistrictsListProps {
  title: string;
  subtitle?: string;
  hrefFor: (district: District) => string;
}

/** The whole org tree's root — Super Admin's home page. Districts have no
 * parent to move between, so unlike every other level here, there is no
 * "move" action on these cards. */
export function DistrictsList({ title, subtitle, hrefFor }: DistrictsListProps) {
  const { data: districts, isLoading, isError, error, refetch } = useListDistrictsQuery();

  const [addOpen, setAddOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);

  return (
    <>
      <OrgListSection
        title={title}
        subtitle={subtitle}
        items={districts}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        getKey={(district) => district.id}
        addLabel="Add district"
        onAdd={() => setAddOpen(true)}
        emptyIcon={Globe}
        emptyTitle="No districts yet."
        emptyDescription="Add a district to start building out the org tree."
        renderCard={(district) => {
          const actions: OrgCardAction[] = [
            { key: 'edit', label: 'Edit', onClick: () => setEditingDistrict(district) },
          ];
          return (
            <OrgCard
              Icon={Globe}
              title={district.name}
              subtitle={district.code}
              href={hrefFor(district)}
              actions={actions}
            />
          );
        }}
      />

      <DistrictModal open={addOpen} district={null} onClose={() => setAddOpen(false)} />
      <DistrictModal
        open={editingDistrict !== null}
        district={editingDistrict}
        onClose={() => setEditingDistrict(null)}
      />
    </>
  );
}
