/**
 * A write that outlives the connection. A model call (reading a resume, writing its lines) can run
 * past a minute, and the proxy in front of the API drops the reply at sixty seconds: the work finishes
 * on the server, the browser sees "failed to fetch", and a retry answers 409 because the record moved.
 *
 * patient() keeps the student out of that: it sends the call, and if the reply is lost to the network
 * (no HTTP status) or to the proxy (502/503/504), it re-reads the record every few seconds until the
 * version has moved past the one it was sent with, then hands that record back as the result. A real
 * answer from the server, including a 409 that carries the record, is passed through untouched.
 */

const LOST = new Set([502, 503, 504]);

export const replyLost = (error) => Boolean(error) && (error.status === undefined || LOST.has(error.status));

export async function patient(send, { before, load, every = 3000, upTo = 150000, waiting, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  try {
    return await send();
  } catch (error) {
    if (!replyLost(error) || !load || before === undefined) throw error;
    waiting?.();
    const deadline = Date.now() + upTo;
    let last = error;
    while (Date.now() < deadline) {
      await sleep(every);
      try {
        const now = await load();
        if ((now?.version ?? 0) > before) return { ...now, recovered: true };
      } catch (e) {
        last = e;
      }
    }
    const out = new Error("The connection dropped before we got your answer back. Reload the page: if your resume was read, it's here.");
    out.cause = last;
    throw out;
  }
}
