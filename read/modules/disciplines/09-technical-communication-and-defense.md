# 09 · Technical communication and defense

*Compression, precision, audience, uncertainty, and staying upright when another engineer attacks your reasoning. About 11 minutes.*

## Write for a past self

Julia Evans writes the post she wishes she had when she was stuck. The subject is a concrete confusion: how groups work on Linux, what a tracing tool actually does, why a certificate authority failed. The reader can act on the result. That is the engineering definition of communication: **information survives the transfer from your head to someone else's, without loss, and your reasoning survives being attacked.** Both halves can be checked. You can count the questions a reader still needs. You can watch whether your model updates when a fact changes.

Communication gets filed under soft skills because it is hard to score, and things that are hard to score get taught badly. Test both parts directly: ask whether the information survived the handoff, then ask whether the reasoning survived a challenge.

## Compression

Explain the system to someone who has five minutes. Then two. Then one sentence. Each pass forces you to decide what is load-bearing. If you cannot compress, you do not yet know which parts matter. The reverse fails too. Someone who can only give the one-sentence version, and cannot expand it back to the five-minute version, has memorised a slogan. Hold both lengths and move between them on demand.

When you publish a project, the same **compression** is the job: the system you built, what the work proves, and a supporting link, in a length a stranger can finish.

## Precision

Can another person execute what you wrote without guessing? This is the reader-side test of a specification, a written description meant to guide someone else's work. Hand the document over, disappear, and count the questions. Precision depends on settled meaning.

Compare “Add trading” with “Allow two authenticated players within interaction distance to exchange mutually accepted inventory items atomically, with no duplication or loss, even if either client disconnects during confirmation.” The second sentence is precise because every clause closes a door. Its length is incidental. A precise sentence often replaces three vague paragraphs.

## Who is reading

The same change is a different explanation to each reader, and knowing what each one needs is the skill.

Another engineer needs the mechanism, the invariants, the blast radius, and how you checked. The blast radius is the set of other code and behaviour the change could affect. Security needs the trust boundaries this crosses and how they are validated. A product owner needs what changed for the user, what it cost, and what it displaced. An executive needs the outcome, the risk, and the decision needed from them. A user needs what they can now do and what they should expect.

Write the engineer's version first. Derive the others from it by removing detail while preserving every claim. If the executive's version contains a claim the engineer's version does not support, you have started marketing.

Evans's habit of saying “I do not know X” belongs here. A named unknown invites a useful reply. A confident paragraph that hides the unknown invites a fight.

## Uncertainty

Three sentences that must never be confused:

> I know this.

> I suspect this.

> The available evidence suggests this.

Each carries a different confidence and each obliges the listener to do something different. An engineer who says “I know” when they mean “I suspect” is spending trust they will need later. An engineer who says “I suspect” about something they verified is wasting everyone's time re-checking it.

**Calibration** is the match between stated confidence and later correctness. When you say ninety percent, are you right about nine times in ten? Calibration is rare, and it is one of the strongest signals a reviewer can give an employer about you.

Every claim in a write-up should make its source of confidence clear. There are four honest positions. “I read it, ran it, or measured it” means you know and can show the evidence. “I inferred it from facts I checked” means you suspect it and can explain the inference. “Another source reported it” means the available evidence suggests it and you can name the source. “I have not checked” means you do not know yet and can explain how you would find out. That final position is a respectable place to be.

## Adversarial defense

An engineer who did not help you reads your change, forms their own model, and then attacks yours. They will change one fact and ask what follows. They will ask why not the alternative. They will point at the invariant you did not test. An assistant cannot sit in that room for you.

Your model updates when a fact changes. “If the gateway can retry, then the idempotency key matters here, and I did not add one; that is a gap.” A memorised explanation repeats the same sentences after the fact has changed.

You distinguish what you know from what you inferred, out loud, without being asked.

You concede correctly. When the attacker is right, say so in one sentence and move on. When they are wrong, answer with evidence and keep your voice steady.

You explain the decision. The question is whether the choice was reasonable given what was known, and whether you knew what you did not know.

The reviewing engineer is a useful reader because they are motivated to find a gap before production does. Treat the challenge as a chance to find that gap while the change can still be fixed. Defense is answering a challenge with evidence.

## Decision records

The lightest form of all of this is the decision record: a short note, written when a decision is made, that says what was decided, what the alternatives were, why this one, and what would make you revisit it. It takes about ten minutes. Months later it is often the only reason anyone, including you, can explain why the system is shaped the way it is. A change without that note is a decision that will have to be reverse-engineered later, usually by you.

Technical communication is the part of engineering that lets reasoning outlive the moment in which it happened. Code preserves the decision a system can execute. A clear explanation preserves why that decision made sense, how certain it was, and which new fact should change it.

The strongest defense is therefore not confidence. It is a model stated clearly enough to challenge and held lightly enough to revise. When the information survives the transfer and the reasoning survives the questions, another person can safely continue the work.
