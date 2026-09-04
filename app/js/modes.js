/**
 * Evaluation modes. The program never bans the assistant; it varies the
 * conditions and says which condition a step is in. A step with no `mode`
 * is Open. Pure data, shared by the step page (which renders the rule) and
 * the coach pack (which tells the coach what it may and may not do).
 *
 * Doctrine: ops/agentic-systems-engineer.md §9; student text: disciplines/13.
 */

export const MODES = {
  open: {
    label: "Open",
    rule: "Every model, agent, search and tool you can reach. This is how employment works.",
  },
  constrained: {
    label: "Constrained",
    rule: "A fixed budget of inference or one model only. The finding is whether more machine was more progress.",
  },
  degraded: {
    label: "Degraded",
    rule: "Your favourite tool removed. Principles over interface.",
  },
  defense: {
    label: "Defense",
    rule: "The assistant is allowed before, and silent during the part that is measured. What is being tested is what transferred into your head.",
  },
  incident: {
    label: "Incident",
    rule: "A live system, a real clock, the assistant allowed. Prioritisation under pressure is the skill.",
  },
};

export function modeOf(node) {
  const key = node?.mode ?? "open";
  return MODES[key] ? { key, ...MODES[key] } : { key: "open", ...MODES.open };
}
