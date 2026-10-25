/**
 * The node-type registry, for code that runs in the browser. A mirror of
 * data/node-types.json (the server reads that file): node-types.test.mjs
 * fails if the two differ, so edit the JSON and copy it here.
 */

export const NODE_TYPES = {
  "version": 1,
  "note": "Every node on a map is one of these types. The board (app/js/graph/node-types.js mirrors this file; a test keeps them equal), the server's map rules (server/maps.py) and the browser's (data/map-rules.mjs) all read it. A node without a type is a step. Change a rule here, not in code.",
  "types": {
    "step": {
      "label": "Step",
      "who": "student",
      "completes": "tasks",
      "onRoad": true,
      "gates": true,
      "canBeNext": true
    },
    "check": {
      "label": "Your coach checks",
      "who": "aden",
      "completes": "signoff",
      "onRoad": true,
      "gates": true,
      "canBeNext": true,
      "needsField": "signoff"
    },
    "campaign": {
      "label": "Campaign",
      "who": "student",
      "completes": "campaign",
      "onRoad": true,
      "gates": true,
      "canBeNext": true,
      "needsField": "campaign",
      "tag": "Drafted for you",
      "mustFollowOneOf": [
        "meeting",
        "check"
      ]
    },
    "habit": {
      "label": "Every week",
      "who": "student",
      "completes": "never",
      "onRoad": true,
      "gates": false,
      "canBeNext": false,
      "tag": "Every week"
    },
    "meeting": {
      "label": "With your coach",
      "who": "both",
      "completes": "tasks",
      "onRoad": true,
      "gates": true,
      "canBeNext": true,
      "tag": "With your coach"
    },
    "reference": {
      "label": "For you to read",
      "who": "nobody",
      "completes": "never",
      "onRoad": false,
      "gates": false,
      "canBeNext": false,
      "tag": "For you to read"
    },
    "milestone": {
      "label": "Milestone",
      "who": "student",
      "completes": "tasks",
      "onRoad": true,
      "gates": true,
      "canBeNext": true
    },
    "builder": {
      "label": "Built with you",
      "who": "student",
      "completes": "tasks",
      "onRoad": true,
      "gates": true,
      "canBeNext": true,
      "tag": "Built with you"
    }
  },
  "groupModes": {
    "all": "Do all of these, in any order.",
    "pick": "Do at least `pick` of these, in any order."
  },
  "confidences": {
    "verified": "Checked against proof: an interview result, a reviewed artifact, or a person's review.",
    "probable": "Follows from what the student told us or their resume says, not yet checked.",
    "unassessed": "We haven't asked about this yet."
  }
};

export const TYPES = NODE_TYPES.types;
export const typeOf = (node) => (node && typeof node.type === "string" ? node.type : "step");
export const specOf = (node) => TYPES[typeOf(node)] ?? TYPES.step;
