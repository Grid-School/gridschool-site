# Your first look at Northline Desk

Northline Desk is a fictional ticket-routing service supplied by GridSchool. It puts some work in the wrong team's queue while its existing checks look healthy. The exercise shows Aden how you investigate unfamiliar code so your first week can focus on what you need.

After the tool checks in Your machine pass, open the studio repository Aden gives you. Complete this observation within a 48-hour calendar window, with a maximum of two hours of work. Tell Aden if setup or scheduling prevents you from starting. The time limit is a scope limit, and an unfinished investigation is useful evidence.

1. Run the existing tests and record the result. In the studio folder, use `python3 -m unittest discover -s tests -v` and `python3 -m northline status`.
2. Spend ten minutes tracing one ticket from input to stored record to team assignment with AI closed. Write one prediction about where the wrong assignment happens.
3. Use AI if helpful. Inspect the code and run `python3 -m northline ingest`. Compare the resulting queue with the intended owner. Record the input, actual result, and expected result.
4. Write or describe one test that would detect the mismatch. If time remains, propose a small fix on your own branch. You do not need to complete a repair for this observation.
5. Post your notes and test output in the Asks channel for your first 1:1. Include where you got stuck and anything an assistant suggested that you could not verify.

In the meeting, close AI and trace the ticket again. Explain the check you would trust and one uncertainty that remains. Aden uses that explanation to choose your next exercise. The observation does not replace your reviewed world change or your later project for a real user.

**Done when** your notes show the commands you ran, your initial prediction, the mismatch you investigated, and the proposed check, or describe exactly where the two-hour attempt stopped.
