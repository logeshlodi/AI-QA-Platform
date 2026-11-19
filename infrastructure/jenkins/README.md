# Jenkins

Two pipelines:

| File                                         | For                                                                                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `infrastructure/jenkins/Jenkinsfile.windows` | A Windows Jenkins (the Windows installer, running as a service). Runs on the machine itself with `bat` steps; the data stage uses Docker Desktop and is marked unstable, not failed, when it is not running. Checked on a Windows laptop with Jenkins 2.580.2. |
| `Jenkinsfile` (repository root)              | A Linux Jenkins with Docker: every stage in the Playwright image, UI shards in parallel.                                                                                                                                                                       |

## Linux Jenkins

The pipeline is the root `Jenkinsfile`. It mirrors the GitHub workflow: type-check, lint, unit and
API specs in the Playwright image; three UI shards in parallel with a merged report; the data suites
on an agent labelled `docker` that can run Docker Compose.

To try it on your own machine with Docker Desktop:

```bash
docker run -d --name jenkins -p 8081:8080 -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock --group-add 0 jenkins/jenkins:lts-jdk21
```

Then, at http://localhost:8081: install the suggested plugins plus **Docker Pipeline**; give the
built-in node the label `docker` (Manage Jenkins > Nodes) and install the Docker CLI in the container
(`docker exec -u root jenkins sh -c "apt-get update && apt-get install -y docker.io docker-compose-v2 nodejs npm"`);
create a **Pipeline** job pointing at this repository with script path `Jenkinsfile`.

Not run yet: the Jenkinsfile has been written against the declarative syntax but has not been
executed on a Jenkins server from this workspace.
