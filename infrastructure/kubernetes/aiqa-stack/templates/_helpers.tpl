{{/* Common labels for every object of the release. */}}
{{- define "aiqa.labels" -}}
app.kubernetes.io/part-of: aiqa-stack
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{/* A Service with a ClusterIP port and, when nodePort is set, the same port published on the node. */}}
{{- define "aiqa.service" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ .name }}
  labels:
    app: {{ .app | default .name }}
spec:
  type: {{ if .nodePort }}NodePort{{ else }}ClusterIP{{ end }}
  selector:
    app: {{ .app | default .name }}
  ports:
    - name: {{ .portName | default "main" }}
      port: {{ .port }}
      targetPort: {{ .targetPort | default .port }}
      {{- if .nodePort }}
      nodePort: {{ .nodePort }}
      {{- end }}
{{- end -}}

{{/* Waits until a TCP port answers; used by init containers. */}}
{{- define "aiqa.waitFor" -}}
- name: wait-for-{{ .name }}
  image: {{ .image }}
  command: ['sh', '-c', 'until nc -z {{ .host }} {{ .port }}; do echo waiting for {{ .host }}:{{ .port }}; sleep 2; done']
{{- end -}}

{{/* Environment the data suites and the order service share: where the stack is. */}}
{{- define "aiqa.stackEnv" -}}
- name: DATABASE_URL
  value: postgres://aiqa:aiqa@postgres:5432/shop
- name: MONGO_URL
  value: mongodb://mongo:27017
- name: KAFKA_BROKERS
  value: kafka:19092
- name: RABBITMQ_URL
  value: amqp://guest:guest@rabbitmq:5672
{{- end -}}

{{/* Tests that write products get a catalog-admin token from the chart's Keycloak, inside the cluster. */}}
{{- define "aiqa.tokenEnv" -}}
{{- if .Values.keycloak.enabled }}
- { name: AUTH_TOKEN_URL, value: 'http://keycloak:8080/realms/aiqa/protocol/openid-connect/token' }
{{- end }}
{{- end -}}

{{/* The parts every test Job shares: never retried by Kubernetes (Playwright retries tests itself),
     kept a day for `kubectl logs`, results written into the repository's .aiqa folder. */}}
{{- define "aiqa.jobSpec" -}}
backoffLimit: 0
ttlSecondsAfterFinished: 86400
{{- end -}}

{{- define "aiqa.resultsVolume" -}}
- name: results
  hostPath: { path: {{ .Values.resultsHostPath }}, type: DirectoryOrCreate }
{{- end -}}

{{/* Variables for a test Job: run history and test metrics go to the right places. */}}
{{- define "aiqa.testEnv" -}}
- { name: CI, value: 'true' }
- { name: AIQA_PUSHGATEWAY, value: 'http://pushgateway:9091' }
- name: PLAYWRIGHT_HTML_OUTPUT_DIR
  value: /work/.aiqa/k8s/{{ .Values.job.name }}-{{ .Values.job.id }}/report
{{- end -}}
