# azure-devops

Two Azure Pipelines definitions, mirroring the GitHub Actions workflow:

| File                                                      | Runs on                                      | What it runs                                                                                  |
| --------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `azure-pipelines.yml` (repository root)                   | Microsoft-hosted `ubuntu-latest`             | Quality stage, then API, three UI shards in the Playwright image, merged report, data suites. |
| `infrastructure/azure-devops/azure-pipelines.windows.yml` | A self-hosted Windows agent (`Default` pool) | One job: install, quality, API, UI, and the data suites when Docker Desktop is running.       |

`setup.yml` and `publish.yml` are the shared step templates of the Linux pipeline.

## Getting it running on a new organisation

1. **Microsoft-hosted agents are not granted automatically to new organisations.** Check
   Organization settings > Pipelines > Parallel jobs. With 0 Microsoft-hosted jobs, request the free
   grant at https://aka.ms/azpipelines-parallelism-request (one job, 60 minutes per run, for a private
   project; Microsoft approves by hand in a few business days). Until then use the Windows pipeline.
2. **Self-hosted agent (one is free):** download the agent from
   https://github.com/microsoft/azure-pipelines-agent/releases, unzip it (for example to `C:\azagent`),
   and run `config.cmd`. It asks for the organisation URL, a personal access token with the
   _Agent Pools (Read & manage)_ scope, the pool (`Default`), and whether to run as a service. Run the
   service as your own Windows account so it can use Docker Desktop and your Playwright browsers.
3. **Pipelines:** Pipelines > New pipeline > GitHub > this repository > Existing Azure Pipelines YAML
   file, once for `/azure-pipelines.yml` and once for
   `/infrastructure/azure-devops/azure-pipelines.windows.yml`.
