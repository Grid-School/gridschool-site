/** What gift/ says after each outcome, and the lines built from the gift (gift.js). Pure, so it's tested. */

const PLAN = { complete: "GridSchool Complete", residency: "the GridSchool Residency" };

export function claimTitle(gift) {
  const who = String(gift?.from || "").trim() || "Someone";
  const you = String(gift?.name || "").trim();
  return `${you ? `${you}, ` : ""}${who} gave you ${PLAN[gift?.plan] || PLAN.complete}.`;
}

/** checkout/'s ?from= for a gift bought from this page: "gift", or "gift:<ad>" when the page came from an ad. */
export function giftSource(from) {
  const ad = String(from || "").replace(/[^\w.:-]/g, "").slice(0, 50);
  return ad && ad !== "gift" ? `gift:${ad}` : "gift";
}

export function shareLabel(gift) {
  const who = String(gift?.from || "").trim() || "them";
  return `Send ${who} a short weekly progress note.`;
}

export const DONE = {
  sent: {
    eyebrow: "Gift sent",
    title: "Thank you. We've emailed them.",
    body: "They have a link to accept it, and nothing starts until they do. You'll get an email the moment they accept or decline, and a full refund if they decline. Your receipt is in your email.",
  },
  already: {
    eyebrow: "Accepted",
    title: "Your map is open.",
    body: "Sign in with the email this gift was sent to. Your sign-in link is in your inbox too.",
    cta: "Sign in to my map",
  },
  residency: {
    eyebrow: "Accepted",
    title: "Welcome to the Residency.",
    body: "I'll email you within a day to set up your board and book our kickoff call. That's where we pick the first project we build together.",
    cta: "Book my kickoff call",
  },
  declined: {
    eyebrow: "Declined",
    title: "No problem. They'll be refunded.",
    body: "We've told them, kindly, and their refund is on its way. If you want to start on your own later, the free check is always there.",
  },
  closed: {
    eyebrow: "Closed",
    title: "This gift is closed.",
    body: "It was declined or refunded. You can still take the free check any time.",
  },
  stopped: {
    eyebrow: "Stopped",
    title: "No more weekly notes.",
    body: "Nothing else changes: the map and everything on it stay exactly as they are.",
  },
  stopFailed: {
    eyebrow: "Didn't work",
    title: "That link didn't stop the notes.",
    body: "",
  },
};
