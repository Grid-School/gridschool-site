/** The public offer (data/intake/offer.json): price, refund and what's prepared for each finding. */
export async function offerOf() {
  const res = await fetch(new URL("../../data/intake/offer.json", location.href));
  return res.json();
}
