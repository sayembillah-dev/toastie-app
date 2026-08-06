import type { Area, District, Division, OrgClub } from './types';

/** One district, three divisions, three areas per division, two or three
 * clubs per area — enough depth to exercise every level of the drill-down
 * without the card grids turning into a scroll marathon. */

export const SEED_DISTRICTS: District[] = [
  {
    id: 'dist-88',
    name: 'District 88',
    code: 'D88',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
];

export const SEED_DIVISIONS: Division[] = [
  { id: 'div-a', districtId: 'dist-88', name: 'Division A', createdAt: '2025-07-01T00:00:00.000Z' },
  { id: 'div-b', districtId: 'dist-88', name: 'Division B', createdAt: '2025-07-01T00:00:00.000Z' },
  { id: 'div-c', districtId: 'dist-88', name: 'Division C', createdAt: '2025-07-01T00:00:00.000Z' },
];

export const SEED_AREAS: Area[] = [
  { id: 'area-a1', divisionId: 'div-a', name: 'Area A1', createdAt: '2025-07-01T00:00:00.000Z' },
  { id: 'area-a2', divisionId: 'div-a', name: 'Area A2', createdAt: '2025-07-01T00:00:00.000Z' },
  { id: 'area-a3', divisionId: 'div-a', name: 'Area A3', createdAt: '2025-07-01T00:00:00.000Z' },
  { id: 'area-b1', divisionId: 'div-b', name: 'Area B1', createdAt: '2025-07-01T00:00:00.000Z' },
  { id: 'area-b2', divisionId: 'div-b', name: 'Area B2', createdAt: '2025-07-01T00:00:00.000Z' },
  { id: 'area-b3', divisionId: 'div-b', name: 'Area B3', createdAt: '2025-07-01T00:00:00.000Z' },
  { id: 'area-c1', divisionId: 'div-c', name: 'Area C1', createdAt: '2025-07-01T00:00:00.000Z' },
  { id: 'area-c2', divisionId: 'div-c', name: 'Area C2', createdAt: '2025-07-01T00:00:00.000Z' },
  { id: 'area-c3', divisionId: 'div-c', name: 'Area C3', createdAt: '2025-07-01T00:00:00.000Z' },
];

export const SEED_ORG_CLUBS: OrgClub[] = [
  {
    id: 'club-01',
    areaId: 'area-a1',
    name: 'Sunrise Toastmasters',
    clubNumber: '1002345',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-02',
    areaId: 'area-a1',
    name: 'Riverside Speakers',
    clubNumber: '1004521',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-03',
    areaId: 'area-a1',
    name: 'Downtown Voices',
    clubNumber: '1009981',
    status: 'low',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-04',
    areaId: 'area-a2',
    name: 'Harborview Communicators',
    clubNumber: '1003310',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-05',
    areaId: 'area-a2',
    name: 'Lakeside Toastmasters',
    clubNumber: '1007765',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-06',
    areaId: 'area-a3',
    name: 'Hilltop Speakers Club',
    clubNumber: '1001120',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-07',
    areaId: 'area-a3',
    name: 'Northgate Toastmasters',
    clubNumber: '1006654',
    status: 'suspended',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-08',
    areaId: 'area-b1',
    name: 'Meridian Speakers',
    clubNumber: '1002298',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-09',
    areaId: 'area-b1',
    name: 'Eastside Orators',
    clubNumber: '1008843',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-10',
    areaId: 'area-b2',
    name: 'Willowbrook Toastmasters',
    clubNumber: '1005567',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-11',
    areaId: 'area-b2',
    name: 'Cedar Park Speakers',
    clubNumber: '1009012',
    status: 'low',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-12',
    areaId: 'area-b2',
    name: 'Bayside Communicators',
    clubNumber: '1004459',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-13',
    areaId: 'area-b3',
    name: 'Summit Toastmasters',
    clubNumber: '1007123',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-14',
    areaId: 'area-c1',
    name: 'Fairview Speakers',
    clubNumber: '1003876',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-15',
    areaId: 'area-c1',
    name: 'Maple Grove Toastmasters',
    clubNumber: '1008291',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-16',
    areaId: 'area-c2',
    name: 'Union Square Orators',
    clubNumber: '1002734',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-17',
    areaId: 'area-c2',
    name: 'Parkside Communicators',
    clubNumber: '1006420',
    status: 'low',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-18',
    areaId: 'area-c3',
    name: 'Crescent City Speakers',
    clubNumber: '1001987',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
  {
    id: 'club-19',
    areaId: 'area-c3',
    name: 'Greenfield Toastmasters',
    clubNumber: '1005843',
    status: 'active',
    createdAt: '2025-07-01T00:00:00.000Z',
  },
];
