# kubernetes

The whole test stack on a local Kubernetes cluster ([kind](https://kind.sigs.k8s.io/)), installed with
one Helm chart, and the test suites running as Kubernetes Jobs inside it.

```bash
npx pnpm k8s:up                  # create the cluster (once), build and load the images, install the chart
npx pnpm k8s:test data           # Postgres, MongoDB and Kafka suites, as a Job
npx pnpm k8s:test ui             # UI suite (Chromium) on the shared Playwright browser server
npx pnpm k8s:test ui --project=firefox --grep @smoke   # any Playwright arguments
npx pnpm k8s:test load stress    # k6 against the order service: smoke | load | stress
npx pnpm k8s:status              # pods, Jobs and services
npx pnpm k8s:down                # delete the cluster
```

Needs Docker, [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation),
[kubectl](https://kubernetes.io/docs/tasks/tools/) and [Helm](https://helm.sh/docs/intro/install/) on
PATH (on Windows: `winget install Kubernetes.kind Helm.Helm`; Docker Desktop ships kubectl). Checked
with kind 0.33.0 (Kubernetes 1.37), Helm 4.3.2 and Docker Desktop on Windows.

## What runs where

| Service           | In the cluster            | On your machine        |
| ----------------- | ------------------------- | ---------------------- |
| Order service     | `order-service:8080`      | http://localhost:30088 |
| Grafana           | `grafana:3000`            | http://localhost:30300 |
| Prometheus        | `prometheus:9090`         | http://localhost:30090 |
| Pushgateway       | `pushgateway:9091`        | http://localhost:30091 |
| Playwright server | `playwright-server:3000`  | ws://localhost:30333/  |
| Postgres          | `postgres:5432`           | localhost:30432        |
| MongoDB           | `mongo:27017`             | localhost:30017        |
| Kafka             | `kafka:19092`             | localhost:30092        |
| Loki, Tempo       | `loki:3100`, `tempo:3200` | through Grafana        |

The 30xxx ports never clash with the Docker Compose stack, so both can run at once.

## How it fits together

- **`aiqa-stack/`** is the Helm chart. Prometheus and Grafana read their configuration and dashboards
  from `aiqa-stack/files/`, and so does Docker Compose: one copy for both.
- **Test Jobs** (`templates/jobs/`) are not installed with the chart. `scripts/k8s.mjs` renders one
  with a unique name (`helm template --show-only`) and applies it, so a suite can run again and again
  without touching the release. Kubernetes never retries a Job (`backoffLimit: 0`); Playwright retries
  tests itself.
- **Results land on your machine.** kind mounts this checkout's `.aiqa` folder into the node, and the
  Jobs write there: HTML reports in `.aiqa/k8s/<suite>-<id>/report`, runs into the shared run history
  (`pnpm aiqa history`, `pnpm report:dashboard`), k6 summaries next to them.
- **The browser server** (`playwright run-server`) runs from the tests image, so its Playwright version
  always equals the tests'. UI Jobs connect with `PW_WS_ENDPOINT`, a setting any local run can use too.
- **Images** are built locally and loaded into kind, tagged with their own digest, so a rebuilt image
  rolls out on the next `k8s:up`. The tests image holds the repository and three browsers: after a
  code change, loading it takes a few minutes.

## Monitoring

Grafana (http://localhost:30300) has four dashboards:

- **Test runs**: every suite's pass rate, duration, failed and flaky tests, slowest tests and
  performance numbers. Test runs push them to the Pushgateway (`AIQA_PUSHGATEWAY`; the Jobs set it).
- **Order service** and **Load tests (k6)**, as in Docker Compose.
- **Explore → Loki** for the logs of every pod (Grafana Alloy collects them), and **Explore → Tempo**
  for traces: one order is one trace, from `POST /orders` through Kafka to Postgres and MongoDB.
  A log line with a `traceId` links to its trace, and a trace links back to its log lines.

## cgroup v1 hosts

Kubernetes 1.35 and later refuse to run on a host with cgroup v1 unless told otherwise. Docker
Desktop on an older WSL2 setup is such a host (`docker info --format '{{.CgroupVersion}}'` prints 1).
`k8s:up` detects it and allows it for this cluster (`failCgroupV1: false`), with a warning. The
lasting fix is cgroup v2 in WSL2: add to `%UserProfile%\.wslconfig`

```ini
[wsl2]
kernelCommandLine = cgroup_no_v1=all
```

then run `wsl --shutdown`, restart Docker Desktop, and recreate the cluster (`k8s:down`, `k8s:up`).
