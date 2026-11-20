# 0009. kind, one Helm chart, and tests as Kubernetes Jobs

Accepted, November 2026.

## Context

The stack needed to run on Kubernetes, the way teams run test infrastructure, without a cloud account.

## Decision

A local kind cluster and one Helm chart (`infrastructure/kubernetes/aiqa-stack`) for the stack and its monitoring. Each suite runs as a Job rendered from the chart; reports land on the laptop through a kind mount. UI Jobs connect to one shared `playwright run-server` with `exposeNetwork: '<loopback>'`, so specs that start their own local server still work.

## Consequences

One command up, one per suite. The data is not kept (`emptyDir`). On a cgroup v1 host (Docker Desktop's default WSL kernel) the kubelet needs `failCgroupV1: false`; the script sets it and says so.
