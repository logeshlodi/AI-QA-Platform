# Architecture decision records

Short records of the decisions that shape this repository: what the situation was, what was
decided, and what it costs. A new decision gets the next number; a reversed one stays, marked superseded.

| #                                                     | Decision                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| [0001](0001-pnpm-workspace-and-catalog.md)            | pnpm workspace with one version catalog                                        |
| [0002](0002-fixtures-for-dependency-injection.md)     | Playwright fixtures for dependency injection                                   |
| [0003](0003-healing-never-rewrites-source.md)         | Self-healing never rewrites source code                                        |
| [0004](0004-ai-optional-local-and-checked.md)         | AI is optional, local by default, and never trusted as is                      |
| [0005](0005-docker-compose-not-testcontainers.md)     | Docker Compose for the data stack, not Testcontainers                          |
| [0006](0006-run-history-sqlite-with-json-fallback.md) | Run history in Node's built-in SQLite, with a JSON fallback                    |
| [0007](0007-platformatic-kafka.md)                    | @platformatic/kafka instead of kafkajs                                         |
| [0008](0008-parallel-partitions-ordered-locks.md)     | Parallel partitions, in order within each, stock locked in SKU order           |
| [0009](0009-kind-helm-and-test-jobs.md)               | kind, one Helm chart, and tests as Kubernetes Jobs                             |
| [0010](0010-test-metrics-through-pushgateway.md)      | Test results reach Prometheus through a Pushgateway                            |
| [0011](0011-contracts-openapi-and-pact.md)            | Contracts: an OpenAPI document generated from zod, and Pact for the consumers  |
| [0012](0012-oauth-keycloak-for-product-writes.md)     | OAuth 2.0 bearer tokens from Keycloak for product writes                       |
| [0013](0013-security-gates-in-ci.md)                  | Security gates: licences, known vulnerabilities, and a ZAP scan of our own API |
