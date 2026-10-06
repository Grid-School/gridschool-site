/**
 * Test seats: boards the desk may write progress on, for trying a map before
 * a student sees it. Every other seat's progress belongs to its student; the
 * admin key can read it and never change it (the server enforces the same
 * list, TEST_SEATS in server/persist.py).
 */

export const TEST_SEAT = "aden";

export function isTestSeat(slug) {
  return slug === TEST_SEAT;
}
