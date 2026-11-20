# interview-learning

An interview question bank for the [learning path](../../docs/learning/README.md). Each question has a
topic, a level (`core`, `senior`, `architect`), the points a strong answer covers, and the files in this
repository that show the answer working. A unit test fails if any of those files disappears.

```bash
pnpm aiqa quiz                          # 10 questions from everything
pnpm aiqa quiz --topic security         # one topic
pnpm aiqa quiz --level senior --count 5
pnpm aiqa quiz --seed 7                 # the same questions again
pnpm aiqa quiz --list                   # print questions and answers, no prompts
pnpm aiqa quiz --coverage               # how many questions each topic has
```

In a quiz, think through your answer, press Enter to see the outline, then mark yourself `y` or `n`.
At the end you get the files to go back to for the ones you missed.

Topics follow the learning path: framework, locators, waiting, network, api, data, ai, performance,
contracts, security, platform. Questions live in [`src/bank.ts`](src/bank.ts); add one by copying an
entry, and run `pnpm test:unit` to check its paths.
