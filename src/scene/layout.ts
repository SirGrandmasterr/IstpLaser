/**
 * Everything sits on one straight axis that enters from the upper left and runs
 * diagonally down to the paper on the floor. Instruments are placed by their
 * distance `t` along that axis. Local +Z of every instrument points along the beam.
 */
import { Quaternion, Vector3 } from 'three';

export const SOURCE = new Vector3(-7.2, 6.4, 0);
export const DIR = new Vector3(1, -0.6, 0).normalize();

export const T_TI = 2.7;
export const T_SE = 5.4;
export const T_NI = 7.5;
export const T_FE = 9.6;

export function axisPoint(t: number, out = new Vector3()): Vector3 {
  return out.copy(SOURCE).addScaledVector(DIR, t);
}

/** Rotates local +Z onto the beam direction. */
export const AXIS_QUAT = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), DIR);

/** Unit vectors spanning the plane perpendicular to the beam (local X and Y). */
export const AXIS_U = new Vector3(1, 0, 0).applyQuaternion(AXIS_QUAT);
export const AXIS_V = new Vector3(0, 1, 0).applyQuaternion(AXIS_QUAT);

export const FLOOR_Y = 0;
export const T_FLOOR = (SOURCE.y - FLOOR_Y) / -DIR.y;

export const TI_POS = axisPoint(T_TI);
export const SE_POS = axisPoint(T_SE);
export const NI_POS = axisPoint(T_NI);
export const FE_POS = axisPoint(T_FE);

/** The sheet of paper lies flat on the floor where the axis lands. */
export const SHEET_W = 3.6;
export const SHEET_H = SHEET_W / Math.SQRT2;
export const SHEET_CENTER = new Vector3(axisPoint(T_FLOOR).x + 0.15, FLOOR_Y + 0.004, 0.15);

/** Sheet-plane coordinates (metres, x right, y away from the viewer) → world. */
export function sheetToWorld(x: number, y: number, out = new Vector3()): Vector3 {
  return out.set(SHEET_CENTER.x + x, SHEET_CENTER.y, SHEET_CENTER.z - y);
}

export function worldToSheet(p: Vector3): { x: number; y: number } {
  return { x: p.x - SHEET_CENTER.x, y: SHEET_CENTER.z - p.z };
}

/** Margin so that a full-size heart stays on the paper. */
export const RETICLE_LIMIT = { x: SHEET_W / 2 - 0.68, y: SHEET_H / 2 - 0.62 };

export const CONSTRUCT_CENTER = new Vector3(-2.0, 2.3, 0);

/** Perpendicular to the beam in the vertical plane, pointing up and right: labels hang out here. */
export const LABEL_SIDE = new Vector3(-DIR.y, DIR.x, 0);

export function labelAnchor(center: Vector3, distance: number): Vector3 {
  return center.clone().addScaledVector(LABEL_SIDE, distance);
}
