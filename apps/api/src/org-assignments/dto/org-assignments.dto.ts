import { ORG_ROLES, ORG_UNIT_TYPES, type OrgRole, type OrgUnitType } from '@toastly/access';
import { IsIn, IsString } from 'class-validator';

export class CreateOrgAssignmentDto {
  @IsIn(ORG_ROLES)
  role!: OrgRole;

  @IsIn(ORG_UNIT_TYPES)
  unitType!: OrgUnitType;

  /** The Area/Division/District id this assignment is for — which column
   * it maps onto is determined by `unitType`. */
  @IsString()
  unitId!: string;
}
