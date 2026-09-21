# 11 · Make it yours

*You need the shipped tool from episode 10. Allow about half a day. Complete
the full engineering ceremony described below.*

## The claim

Choose a repository you care about and run nanograph against it. Then build one analysis that the earlier episodes did not require. Your choice of analysis should answer a question you genuinely have about the repository.

## What you will ship

1. A fork (or your main repo) installable by a stranger.
2. README numbers from *your* chosen repo. Numbers from the lab fixture do
 not satisfy this requirement.
3. One new query or view that exists only because you wanted the answer.
4. The full engineering ceremony: an engineering contract, a failure log, and a written review request.

## The unasked analysis

The new analysis can answer a question such as:

- "Show me every function that both touches the database and formats HTML."
- "Rank files by how often they appear in blast radii of payment code."
- "List modules that are only coupled through `utils`."

Renaming a flag, restyling `--serve`, or rephrasing the README does not add an analysis. During review, you will need to explain why you wanted the answer your analysis provides.

## Defense feed

You will use this fork in your live defense. Prepare to explain what the system does, what you measured, what you chose not to build, and how a stranger can verify the result. If you do not know an answer, state how you would find it.

## Exercise (the whole node)

The new analysis is the complete exercise. Commit it with one paragraph explaining why you wanted the answer.

**Done when** a stranger can install your fork, run it on a repository, reproduce your measurements, and use the new analysis you chose to build. If you are a Lab student, submit the pull request or repository URL for review by following the same engineering ceremony as the studio mission.

## Sources

- Your earlier episodes provide the starting implementation for the fork.
- Continue extending the tool after the series when you have another question
 the graph can answer.
