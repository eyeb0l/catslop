// Shared layout. Distances are metres. The cat faces local -Z;
// yaw 0 looks toward world -Z (the house). The garden opens toward +Z.

export const LEVEL = {
  house: { faceZ: -5.2, minX: -7.5, maxX: 7.5, backZ: -9.2, height: 3.8 },
  bounds: { minX: -12.4, maxX: 12.4, minZ: -5.2, maxZ: 14.4 },
  wallH: 1.52,
  pond: { x: 8.2, z: 6.7, rx: 3.4, rz: 2.55 },
  bench: { x: -7.55, z: 4.9, w: 1.85, d: 0.62, seat: 0.42, seatThick: 0.08 },
  bird: { x: 6.2, z: 8.7, top: 1.06 },
  laundry: { x1: -4.3, z1: 10.55, x2: 1.9, z2: 11.45, y: 1.38 },
  mitten: { x: -1.05, y: 1.08, z: 10.95 },
  ivy: { x: 2.95, z: -4.58, r: 0.52, top: 2.28 },
  sill: { x: 4.7, z: -4.72, w: 1.85, d: 0.78, y: 2.18 },
  tin: { x: -3.55, y: 0.2, z: -4.42 },
  mouse: { x: -7.55, y: 0.05, z: 4.9 },
  bell: { x: 6.2, y: 1.14, z: 8.7 },
  stone: { x: 6.55, y: 0.05, z: 5.05 },
  magpie: { x: 12.05, y: 1.66, z: 3.15 },
  ribbon: { x: 11.05, y: 0.16, z: 3.15 },
  shop: { x: -4.85, y: 0.04, z: -3.35 },
  start: { x: 0.15, y: 0, z: 1.05, yaw: Math.PI },
  yarn: { x: 0.85, z: 3.25 },
  tree: { x: -10.35, z: 11.55 },
  stump: { x: -1.15, z: 9.45, y: 0.36, r: 0.34 },
  door: { x: -3.7 },
  step: { x: -3.7, z: -4.7, w: 1.5, d: 0.85, y: 0.11 },
  crates: [
    { x: -1.2, z: 9.05, s: 0.5 },
    { x: 2.55, z: 3.45, s: 0.44 },
  ],
  pots: [
    { x: -5.55, z: -4.05 },
    { x: -9.15, z: 3.45 },
    { x: 5.15, z: 4.45 },
    { x: 2.85, z: 12.55 },
    { x: -10.55, z: 7.9 },
  ],
  can: { x: -6.15, z: 4.15 },
  dayLength: 420,
};

export const HINTS = {
  tin: 'A sardine tin is waiting on the step.',
  mouse: 'Something small has gone under the bench.',
  mitten: 'The laundry line is holding a mitten hostage.',
  bell: 'A brass bell glints on the bird table.',
  stone: 'The pond is sitting on a warm stone.',
  ribbon: 'A magpie on the east wall has the ribbon. It likes shiny things.',
  sill: 'The ivy climbs to the windowsill.',
};
