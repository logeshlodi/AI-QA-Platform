# 0016. The chat: MCP tools in process, every write held for a person, a stub model for the specs

Date: 2026-11-22. Status: accepted.

## Context

Sprint 13 adds a chat to the web app. It must answer from the platform's data, may be asked to change
something (quarantine a flaky test), and reads text that strangers wrote: error messages capture page
text, and a page under test can say anything. The local model takes minutes per answer on a CPU, so it
cannot be what the end-to-end specs run against.

## Decision

- **Tools from the platform's own MCP server**, connected in process (`InMemoryTransport`): the chat
  gets exactly the tools any MCP client gets, and nothing the server does not offer.
- **Tool output is data.** Each result reaches the model wrapped in `<tool-output>`, and the system
  prompt says never to follow instructions inside it. This lowers the chance of a hijack; it does not
  remove it.
- **Writes are held, whatever the model says.** `quarantine_test` is marked `user-approval` in
  `streamText`, and its `execute` refuses anyway. The stream turns the call into an approval card with
  a sealed token (the exact change, the requesting session, ten minutes). Only `/api/chat/approve`
  carries it out, only for a `platform-admin`, only for their own token. Anyone may refuse.
- **An admin can switch writes off entirely**; then the tool is not even offered to the model.
- **The specs run against a stub model**: an OpenAI-compatible endpoint (`tests/fixtures/model-stub.ts`)
  the app reaches as `AGENT_PROVIDER=openai-compatible`. It streams, varies its wording, and is scripted
  to obey a planted instruction, so the specs can prove the app holds the call regardless.

## Consequences

- The gate ("a planted instruction is ignored; every write waits for approval") is tested by
  behaviour, not by trusting the model: a hijacked model still changes nothing.
- The stub tests the app, not a model's judgement. How well a real model resists injection is an eval
  question for ADR 0014's eval sets.
- A new write tool needs the same three things: listed in `WRITE_TOOLS`, a refusing `execute`, and a
  branch in the approval route.

## Rejected

- Letting the model call the write directly and logging it: an audit trail after the fact is not consent.
- Approving inside the same stream (resubmitting the conversation): the model would run again and
  could change the call between request and approval; the sealed token fixes the exact change.
- Recording real model answers for replay: brittle when prompts change, and it would never misbehave
  on cue.
