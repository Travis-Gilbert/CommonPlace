import assert from 'node:assert/strict';
import test from 'node:test';

import { BridgeCommandError, validateBridgeCommands } from './bridge.js';
import {
  hostedCancelEnvelope,
  hostedPromptEnvelope,
} from './hosted-client.js';
import {
  TURN_CONTEXT_SCHEMA,
  applySessionUpdate,
  beginTurn,
  cancelTurn,
  completeTurn,
  createTheoremAgentState,
  failTurn,
  type TurnContext,
} from './state.js';

const turnContext: TurnContext = {
  schema_version: TURN_CONTEXT_SCHEMA,
  route: 'research',
  published_acknowledgement: 'I will trace the latency path you described.',
  context_anchors: ['latency path'],
  required_capabilities: ['web_search'],
};

function runningState() {
  return beginTurn(
    createTheoremAgentState({ mode: 'composed', bindingId: 'agent:theorem' }, 's1'),
    'Why is this request slow?',
    turnContext,
  );
}

test('keeps acknowledgement separate from substantive response and head contributions', () => {
  const state = runningState();
  const assistant = state.messages.at(-1)!;

  assert.equal(assistant.acknowledgement, turnContext.published_acknowledgement);
  assert.equal(assistant.text, '');
  assert.deepEqual(assistant.contributions, []);
});

test('hosted envelopes carry typed context while legacy prompts stay unchanged', () => {
  assert.deepEqual(hostedPromptEnvelope('s1', 'hello'), {
    type: 'prompt',
    session_id: 's1',
    text: 'hello',
  });
  assert.deepEqual(hostedPromptEnvelope('s1', 'hello', turnContext), {
    type: 'prompt',
    session_id: 's1',
    text: 'hello',
    turn_context: turnContext,
  });
  assert.deepEqual(hostedCancelEnvelope('s1'), {
    type: 'cancel_prompt',
    session_id: 's1',
  });
});

test('bridge preserves valid context and rejects malformed context', () => {
  const command = {
    type: 'add-message' as const,
    message: { role: 'user' as const, parts: [{ type: 'text' as const, text: 'hello' }] },
    parentId: null,
    sourceId: null,
    turnContext,
  };
  const validated = validateBridgeCommands([command])[0]!;
  assert.equal(validated.type, 'add-message');
  if (validated.type !== 'add-message') assert.fail('expected add-message command');
  assert.equal(validated.turnContext, turnContext);
  assert.throws(
    () =>
      validateBridgeCommands([
        {
          ...command,
          turnContext: { ...turnContext, schema_version: 'unversioned' },
        },
      ]),
    BridgeCommandError,
  );
  assert.throws(
    () =>
      validateBridgeCommands([
        {
          ...command,
          turnContext: {
            ...turnContext,
            context_anchors: [''],
            required_capabilities: Array.from({ length: 9 }, (_, index) => `cap-${index}`),
          },
        },
      ]),
    BridgeCommandError,
  );
});

test('deduplicates delivered updates and settles once after out of order activity', () => {
  const activity = { sessionUpdate: 'theorem_turn_activity', status: 'running' };
  const answer = {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'The queue is saturated.' },
    eventId: 'hosted-answer-1',
  };
  let state = applySessionUpdate(runningState(), answer);
  state = applySessionUpdate(state, activity);
  state = applySessionUpdate(state, answer);
  state = completeTurn(state, 'end_turn');
  state = failTurn(state, 'late failure');
  state = cancelTurn(state);

  assert.equal(state.messages.at(-1)!.text, 'The queue is saturated.');
  assert.equal(state.turnStatus, 'complete');
  assert.equal(state.activityStatus, 'completed');
  assert.equal(state.error, null);
});

test('server occurrence IDs deduplicate replay without collapsing equal chunks', () => {
  const update = {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'same' },
  };
  let hosted = applySessionUpdate(runningState(), { ...update, eventId: 'run:7:answer:0' });
  hosted = applySessionUpdate(hosted, { ...update, eventId: 'run:7:answer:0' });
  hosted = applySessionUpdate(hosted, { ...update, eventId: 'run:7:answer:1' });

  let local = applySessionUpdate(runningState(), update);
  local = applySessionUpdate(local, update);

  assert.equal(hosted.messages.at(-1)!.text, 'samesame');
  assert.equal(local.messages.at(-1)!.text, 'samesame');
});

test('legacy turns remain compatible without a published prelude', () => {
  let state = beginTurn(
    createTheoremAgentState({ mode: 'single', bindingId: null }, 'legacy'),
    'hello',
  );
  state = applySessionUpdate(state, {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'Hello.' },
  });
  state = completeTurn(state, undefined);

  assert.equal(state.messages.at(-1)!.acknowledgement, null);
  assert.equal(state.messages.at(-1)!.text, 'Hello.');
  assert.equal(state.turnStatus, 'complete');
});

test('cancel and failure are terminal and ignore stale updates', () => {
  const cancelled = applySessionUpdate(runningState(), {
    sessionUpdate: 'theorem_turn_activity',
    status: 'cancelled',
  });
  const stale = applySessionUpdate(cancelled, {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'stale answer' },
  });
  const failed = failTurn(runningState(), 'provider failed');

  assert.equal(stale.turnStatus, 'cancelled');
  assert.equal(stale.messages.at(-1)!.text, '');
  assert.equal(failed.turnStatus, 'failed');
  assert.equal(failed.error, 'provider failed');
});

test('refusal remains terminal when a later completion is delivered', () => {
  const refused = completeTurn(runningState(), 'refusal');
  const replayed = completeTurn(refused, 'end_turn');

  assert.equal(replayed.turnStatus, 'refused');
});
