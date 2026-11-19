# kubernetes

Not built yet. Planned for the Kubernetes and monitoring sprint, after the performance sprint:

- a local [kind](https://kind.sigs.k8s.io/) cluster and a Helm chart for the order-service stack
  (Postgres, MongoDB, Kafka, the service, Prometheus, Grafana);
- the test suites run as Kubernetes Jobs against it;
- a shared Playwright browser server (`playwright run-server`) that UI tests connect to.

Until then the stack runs on Docker Compose: see `infrastructure/docker/stack.compose.yml`.
