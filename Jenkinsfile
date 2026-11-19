// Jenkins declarative pipeline: the same stages as .github/workflows/ci.yml.
// Needs: the Pipeline, Docker Pipeline and JUnit plugins, and an agent that can run Docker
// (the data stage starts the Compose stack). HTML Publisher is optional; reports are archived anyway.
// Try it locally: infrastructure/jenkins/README.md.

pipeline {
  agent none
  options {
    timeout(time: 60, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '30'))
    disableConcurrentBuilds(abortPrevious: true)
  }
  triggers { cron('H 1 * * *') } // nightly
  environment { CI = 'true' }

  stages {
    stage('Quality and API') {
      // Same image as Docker and GitHub: Node, browsers and their libraries are already inside.
      agent { docker { image 'mcr.microsoft.com/playwright:v1.65.0-noble'; args '--ipc=host' } }
      stages {
        stage('Install') { steps { sh 'npm install -g pnpm@10 && pnpm install --frozen-lockfile' } }
        stage('Type-check') { steps { sh 'pnpm typecheck' } }
        stage('Lint') { steps { sh 'pnpm lint' } }
        stage('Unit tests') { steps { sh 'pnpm test:unit' } }
        stage('API specs') {
          steps { sh 'pnpm test:api' }
          post {
            always {
              junit allowEmptyResults: true, testResults: 'packages/api-framework/test-results/junit.xml'
              archiveArtifacts allowEmptyArchive: true, artifacts: 'packages/api-framework/playwright-report/**'
            }
          }
        }
      }
    }

    stage('UI specs') {
      // Three shards in parallel, each in its own container; blob reports merged afterwards.
      matrix {
        axes { axis { name 'SHARD'; values '1', '2', '3' } }
        agent { docker { image 'mcr.microsoft.com/playwright:v1.65.0-noble'; args '--ipc=host' } }
        stages {
          stage('Shard') {
            steps {
              sh 'npm install -g pnpm@10 && pnpm install --frozen-lockfile'
              sh 'pnpm --filter @aiqa/playwright-framework exec playwright test --shard=${SHARD}/3 --grep-invert @audit'
            }
            post {
              always {
                junit allowEmptyResults: true, testResults: 'packages/playwright-framework/test-results/junit.xml'
                stash name: "blob-${SHARD}", includes: 'packages/playwright-framework/blob-report/**', allowEmpty: true
              }
            }
          }
        }
      }
    }

    stage('Merge UI report') {
      agent { docker { image 'mcr.microsoft.com/playwright:v1.65.0-noble' } }
      steps {
        sh 'npm install -g pnpm@10 && pnpm install --frozen-lockfile'
        script { ['1', '2', '3'].each { n -> unstash "blob-${n}" ; sh "mkdir -p all-blob-reports && cp packages/playwright-framework/blob-report/*.zip all-blob-reports/ || true" } }
        sh 'pnpm --filter @aiqa/playwright-framework exec playwright merge-reports --config merge.config.ts ../../all-blob-reports'
      }
      post {
        always {
          archiveArtifacts allowEmptyArchive: true, artifacts: 'packages/playwright-framework/playwright-report/**, .aiqa/dashboard/**'
        }
      }
    }

    stage('Data suites') {
      // Runs on the agent itself: it starts containers with Docker Compose.
      agent { label 'docker' }
      steps {
        sh 'npm install -g pnpm@10 && pnpm install --frozen-lockfile'
        sh 'pnpm stack:test'
      }
      post {
        failure { sh 'docker compose -f infrastructure/docker/stack.compose.yml logs order-service || true' }
        always {
          sh 'pnpm stack:down || true'
          junit allowEmptyResults: true, testResults: 'packages/data-framework/test-results/junit.xml'
          archiveArtifacts allowEmptyArchive: true, artifacts: 'packages/data-framework/playwright-report/**, .aiqa/dashboard/**'
        }
      }
    }
  }
}
