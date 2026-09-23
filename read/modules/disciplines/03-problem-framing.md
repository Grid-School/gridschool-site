# 03 · Problem framing

*How to get from “something feels wrong” to a change worth making. About 11 minutes.*

## The expensive leap

A player says, “Movement feels laggy,” and somebody opens the editor before asking another question. Perhaps the server is slow. Perhaps the client needs smoother animation. Perhaps a clever queue will settle the matter. Within ten minutes there are branches, tickets, and opinions. There may even be code.

The only missing item is evidence that anybody is fixing the problem the player had.

This happens because a complaint tends to arrive as a small bundle. It contains something a person noticed, what the experience felt like, and often a guess about what should change. Those parts sound close enough to get mixed together. Pulling them apart is called **problem framing**, and it can save a week of excellent work on the wrong problem.

Hillel Wayne's warning is the reason the pause is worth taking. You cannot reason your way to the cause of a system failure by thinking hard in a chair. Too many parts affect each other. The useful work is to write down competing explanations and gather the cheapest evidence that can tell them apart.

## Walk the laggy player

An **observation** is a fact another person could check. Suppose three players used the word “laggy” in a support channel on Tuesday. Suppose a dashboard shows that eighteen percent of new players return seven days after joining. Both statements may matter, but neither one explains why anything happened.

A **symptom** describes the experience. “Movement feels laggy” is useful because it preserves the player's words. It still leaves open what the player saw. The avatar might respond late, move in jumps, or slide after the key is released. Each experience points toward a different investigation.

Then come the **hypotheses**, the possible explanations. The network may take too long to carry each movement update. The server may update the world too slowly. The player's device may display the updates poorly, or the keyboard handler may respond late. The first plausible explanation usually feels especially intelligent because it occurred to us. That feeling is not evidence. A second and third explanation give the first one some competition.

A **cause** is the explanation that best survives contact with logs, traces, measurements, a reproduction, or another question to the player. Certainty is rare. You may end with sixty percent confidence rather than complete certainty. That is still useful because it tells the next person how much weight the conclusion can bear.

The **opportunity** is what would improve if the cause were removed. If smoother movement keeps new players in the world long enough to meet somebody, the opportunity may be valuable. If the delay occurs once on an internal screen used by two people a month, very little may change. A real problem can still be too small to deserve a week of work.

At the end comes the **intervention**, the smallest change that can test the explanation. If data takes much longer to travel to one server location, route a small group elsewhere and compare the result. If the server updates the world less often when many players join, change the update rate in a controlled test and measure what happens. A useful intervention examines the suspected cause.

The names make a tidy path: observation, symptom, hypotheses, cause, opportunity, intervention. Real investigations loop. You will return to an earlier step when a measurement kills a favourite explanation. That is the work succeeding.

## When the solution arrives first

“Add trading” sounds like a piece of work, but it has arrived at the far end of the path with no story attached. The sensible question is, “What would trading improve?”

Suppose the answer is that players find the game lonely. Now there is something to investigate. Three players said so in a support channel, although nobody asked the others. The spawn area, where new players first appear, may be empty. Players may have no way to find one another, or no reason to interact once they do. Trading becomes one possible response among several, each with a different cost and a different chance of helping.

Walking backward does not dismiss the original idea. It gives the idea a fair trial. Trading may win. If it does, you will know what result to watch after it ships. If it loses, you have avoided building a marketplace in order to solve a navigation problem.

Keep a short record of the explanations and interventions you set aside. The record prevents an old idea from returning next week with its history erased, and it gives the eventual specification a clear boundary. “No trading system in this change” is useful information when somebody else must decide what to build.

## Why good tools make this harder

Opening an editor feels productive because something changes immediately. An AI assistant makes the temptation stronger. Give it a symptom and it can produce a convincing cause, a plan, and a patch before you have finished your coffee. Fluency makes the leap difficult to notice.

The assistant is useful once you give it the right job. Ask it for competing explanations. Have it name the evidence that would distinguish them. Let it search code or summarize logs you have already chosen. You still gather the evidence and record where and when it came from, because an old log or an unattributed number can support a neat conclusion about a system that has already changed.

Code can work perfectly and still leave the original problem untouched. If movement feels delayed because the player is far from the server, polishing the avatar's animation may produce a beautiful patch with no useful effect. The waste came from beginning one question too late.

## Choosing a problem worth the week

A stuck door that bothered one player once is worth recording. If a dashboard showed that forty percent of first sessions ended within three minutes, the pattern would deserve a closer look. Judge the scale by how many people encounter the problem, what it prevents them from doing, and what becomes possible if it is fixed.

The same reasoning applies outside a game. A warehouse manager who says “pick accuracy fell” means that workers selected the wrong items for too many orders. Before changing the warehouse software, an engineer still has to learn where the errors occurred, what the workers experienced, and which explanations fit the evidence. Using the words of the people who operate the system helps keep the investigation tied to the result they need.

Problem framing is a modest practice. You slow down long enough to separate what happened from what it might mean. You entertain several explanations, gather the cheapest evidence that can distinguish them, and estimate whether the result deserves the cost of a change. Then you can write a specification: a precise description of what should change, what stays outside the work, and what result the eventual code should improve.
