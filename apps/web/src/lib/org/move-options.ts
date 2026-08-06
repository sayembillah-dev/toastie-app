import type { Area, District, Division } from './types';

/** Move-target labels for multi-parent scopes (District, Super Admin), where
 * several areas or divisions can share a name across different branches and
 * the parent needs to be in the label to tell them apart. */

export function areaMoveOptions(
  areas: readonly Area[],
  divisions: readonly Division[],
): { value: string; label: string }[] {
  const divisionsById = new Map(divisions.map((division) => [division.id, division]));
  return areas.map((area) => {
    const division = divisionsById.get(area.divisionId);
    return { value: area.id, label: division ? `${division.name} · ${area.name}` : area.name };
  });
}

export function divisionMoveOptions(
  divisions: readonly Division[],
  districts: readonly District[],
): { value: string; label: string }[] {
  const districtsById = new Map(districts.map((district) => [district.id, district]));
  return divisions.map((division) => {
    const district = districtsById.get(division.districtId);
    return {
      value: division.id,
      label: district ? `${district.name} · ${division.name}` : division.name,
    };
  });
}
