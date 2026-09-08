/**
 * Instructor view without retyping ?admin=1. One device-local bit, switched on
 * from the admin console (which never ships to the public site) and switched
 * off from the board rail. It changes what this browser renders, not what it
 * may write: every real write still requires the ADMIN_TOKEN.
 */

const KEY = "gridschool.instructorView.v1";

export function isInstructorDevice() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setInstructorDevice(on) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  return isInstructorDevice();
}
