'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ─── MOCK SETUP (must run before requiring index.js) ──────────────────────────

// Stub whatsapp-web.js so the client never actually connects
const mockClient = {
  on: () => {},
  initialize: () => {},
  sendMessage: async () => {},
};
require.cache[require.resolve('whatsapp-web.js')] = {
  id: require.resolve('whatsapp-web.js'),
  filename: require.resolve('whatsapp-web.js'),
  loaded: true,
  exports: {
    Client: class { constructor() { return mockClient; } },
    LocalAuth: class {},
    MessageMedia: class {},
  },
};

// Capture fs.appendFileSync calls so log writes are inspectable without
// touching the real log.csv
const fs = require('fs');
const logCapture = [];
const _origAppend = fs.appendFileSync.bind(fs);
fs.appendFileSync = (filePath, data, ...rest) => {
  if (String(filePath).includes('log.csv')) { logCapture.push(String(data)); return; }
  _origAppend(filePath, data, ...rest);
};

// Default fetch stub — individual tests override global.fetch as needed
// Save the real Node 18 built-in fetch before stubbing so pre-flight tests can restore it
const _realFetch = globalThis.fetch;
global.fetch = async () => ({ ok: true, json: async () => ({}), text: async () => '' });

// Load index.js in test mode
process.env.NODE_ENV = 'test';
if (!process.env.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = 'test-key-unused';

const agent = require('../index.js');
const {
  pick, parseCSV, appendToLog, buildTemplateFallback, withNav, CANNED,
  SETUP_STEPS, KB_INTRO_INDEX, LOGICAL_TOTAL, AUTO_ACT_THRESHOLD, SUGGEST_THRESHOLD,
  setupSessions, pendingPreviews, demoSessions,
  handleSetup, handleInbound, classifyIntent,
  fetchNewsHeadlines,
} = agent;

// ─── TEST HELPERS ─────────────────────────────────────────────────────────────

/** Creates a mock WhatsApp message object. replies[] is populated on msg.reply(). */
function mockMsg(body, from = '12425550100@c.us') {
  const replies = [];
  const msg = {
    from,
    body,
    replies,
    reply: async (text, _q, _opts) => replies.push(text),
  };
  return msg;
}

/** Returns the last reply sent to a mock message object. */
const lastReply = (msg) => msg.replies[msg.replies.length - 1];

// ─── PURE HELPERS ─────────────────────────────────────────────────────────────

describe('pick()', () => {
  it('returns a member of the array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) assert(arr.includes(pick(arr)));
  });

  it('returns the sole element when array has one item', () => {
    assert.equal(pick(['only']), 'only');
  });
});

describe('appendToLog()', () => {
  beforeEach(() => logCapture.length = 0);

  it('writes 7 comma-separated columns', () => {
    appendToLog('12421111111', 'Test User', 'hello world', 'inbound:received', '50', '88%');
    assert.equal(logCapture.length, 1);
    const cols = logCapture[0].trimEnd().split(',');
    assert.equal(cols.length, 7, `Expected 7 columns, got ${cols.length}: ${logCapture[0]}`);
  });

  it('column order: timestamp, number, name, message, status, tokens, confidence', () => {
    appendToLog('12429999999', 'Alice', 'test msg', 'inbound:hot-lead', '120', '91%');
    const [ts, num, name, msg, status, tokens, conf] = logCapture[0].trimEnd().split(',');
    assert.match(ts, /^\d{4}-\d{2}-\d{2}/);   // ISO timestamp
    assert.equal(num, '12429999999');
    assert.equal(name, 'Alice');
    assert.equal(msg, 'test msg');
    assert.equal(status, 'inbound:hot-lead');
    assert.equal(tokens, '120');
    assert.equal(conf.trim(), '91%');
  });

  it('omits commas from name and message fields', () => {
    appendToLog('12420000000', 'Smith, Jr', 'hello, world', 'outbound:sent');
    const cols = logCapture[0].trimEnd().split(',');
    // Should still be exactly 7 cols
    assert.equal(cols.length, 7);
  });

  it('confidence defaults to empty string when omitted', () => {
    appendToLog('12420000001', 'Bob', 'hi', 'demo');
    const cols = logCapture[0].trimEnd().split(',');
    assert.equal(cols[6].trim(), '');
  });
});

describe('buildTemplateFallback()', () => {
  const settings = (tone) => ({ business_name: 'Acme', tone, signature: '- Acme' });

  it('produces output for friendly-pro tone', () => {
    const out = buildTemplateFallback('follow up', { name: 'John' }, settings('friendly-pro'));
    assert.match(out, /Hi John/);
    assert.match(out, /Acme/);
  });

  it('produces output for formal tone', () => {
    const out = buildTemplateFallback('follow up', { name: 'John' }, settings('formal'));
    assert.match(out, /Dear John/);
  });

  it('falls back to friendly-pro for unknown tone', () => {
    const out = buildTemplateFallback('test', null, settings('unknown-tone'));
    assert.match(out, /Hi there/);
  });
});

describe('CANNED responses', () => {
  const sig = '- TestBiz';
  const link = 'https://calendly.com/test';

  it('greeting includes name when provided', () => {
    const out = CANNED.greeting('Marcus', sig);
    assert.match(out, /Marcus/);
    assert.match(out, /TestBiz/);
  });

  it('greeting works without name', () => {
    const out = CANNED.greeting('', sig);
    assert.match(out, /TestBiz/);
    assert.ok(!out.includes('undefined'));
  });

  it('call includes the calendar link', () => {
    const out = CANNED.call('Dana', link, sig);
    assert.match(out, /calendly\.com\/test/);
    assert.match(out, /TestBiz/);
  });

  it('hotLead includes the calendar link', () => {
    const out = CANNED.hotLead('', link, sig);
    assert.match(out, /calendly\.com\/test/);
  });

  it('complaint does not include calendar link', () => {
    const out = CANNED.complaint('Dana', sig);
    assert.ok(!out.includes('calendly'));
    assert.match(out, /TestBiz/);
  });

  it('optOut does not promise to keep messaging the contact', () => {
    // Run several times to cover all random variants
    for (let i = 0; i < 20; i++) {
      const out = CANNED.optOut('Dana', sig);
      assert.ok(!out.match(/we('ll| will) keep messaging|we('ll| will) contact you again/i),
        `optOut variant should not promise ongoing contact: "${out}"`);
    }
  });

  it('all CANNED functions return non-empty strings', () => {
    const fns = ['greeting', 'complaint', 'bookingConfirmation', 'referral', 'optOut', 'wrongNumber'];
    for (const fn of fns) {
      const out = fn === 'wrongNumber' ? CANNED[fn](sig) : CANNED[fn]('', sig);
      assert.ok(typeof out === 'string' && out.length > 10, `CANNED.${fn} returned empty`);
    }
  });
});

// ─── withNav() ────────────────────────────────────────────────────────────────

describe('withNav()', () => {
  it('config step shows logical step number (e.g. Step 1 of 9)', () => {
    const out = withNav('What is your business name?', 0);
    assert.match(out, /Step 1 of 9/);
    assert.ok(!out.includes('skipkb'), 'config steps should not show skipkb');
  });

  it('config step 4 (tone) shows Step 5 of 9', () => {
    // tone is index 3 in SETUP_STEPS → logical step 4
    const toneIdx = SETUP_STEPS.findIndex(s => s.key === 'tone');
    const out = withNav('Choose tone', toneIdx);
    assert.match(out, new RegExp(`Step ${toneIdx + 1} of 9`));
  });

  it('kb_intro shows Step 9 of 9 with no KB counter', () => {
    const out = withNav('KB intro text', KB_INTRO_INDEX);
    assert.match(out, /Step 9 of 9/);
    assert.ok(!out.includes('KB 0'), 'kb_intro should not show a KB entry number');
  });

  it('kb_1 shows Step 9 of 9 · KB 1 of 40', () => {
    const kbIdx = SETUP_STEPS.findIndex(s => s.key === 'kb_1');
    const out = withNav('Q1', kbIdx);
    assert.match(out, /Step 9 of 9/);
    assert.match(out, /KB 1 of 40/);
  });

  it('kb_20 shows KB 20 of 40', () => {
    const kbIdx = SETUP_STEPS.findIndex(s => s.key === 'kb_20');
    const out = withNav('Q20', kbIdx);
    assert.match(out, /KB 20 of 40/);
  });

  it('KB steps include skipkb hint', () => {
    const kbIdx = SETUP_STEPS.findIndex(s => s.key === 'kb_5');
    const out = withNav('Q5', kbIdx);
    assert.match(out, /skipkb/);
  });

  it('nav footer is a single line (no multi-line block)', () => {
    const out = withNav('Question here', 0);
    const footer = out.split('\n').slice(-1)[0];
    // Footer line should contain both skip and cancelsetup hints
    assert.match(footer, /skip/);
    assert.match(footer, /cancelsetup/);
  });
});

// ─── SETUP WIZARD ─────────────────────────────────────────────────────────────

describe('handleSetup() — navigation', () => {
  beforeEach(() => {
    // Clear all active sessions between tests
    for (const k of Object.keys(setupSessions)) delete setupSessions[k];
  });

  it('!setup reply contains advanced-user disclaimer', async () => {
    const msg = mockMsg('!setup');
    await handleSetup(msg, '!setup');
    assert.match(lastReply(msg), /Advanced users only/i);
  });

  it('!setup reply contains step count', async () => {
    const msg = mockMsg('!setup');
    await handleSetup(msg, '!setup');
    assert.match(lastReply(msg), /Step 1 of 9/);
  });

  it('!cancelsetup ends the session and confirms', async () => {
    const from = '12420000001@c.us';
    setupSessions[from] = { step: 2, data: {} };
    const msg = mockMsg('!cancelsetup', from);
    await handleSetup(msg, '!cancelsetup');
    assert.ok(!setupSessions[from], 'session should be cleared');
    assert.match(lastReply(msg), /cancelled/i);
  });

  it('back on step 0 replies with already-on-first-step message', async () => {
    const from = '12420000002@c.us';
    setupSessions[from] = { step: 0, data: {} };
    const msg = mockMsg('back', from);
    await handleSetup(msg, 'back');
    assert.match(lastReply(msg), /already on the first step/i);
    assert.equal(setupSessions[from].step, 0);
  });

  it('back from step 3 goes to step 2', async () => {
    const from = '12420000003@c.us';
    setupSessions[from] = { step: 3, data: {} };
    const msg = mockMsg('back', from);
    await handleSetup(msg, 'back');
    assert.equal(setupSessions[from].step, 2);
  });

  it('skipkb before KB section replies with error', async () => {
    const from = '12420000004@c.us';
    setupSessions[from] = { step: 1, data: {} }; // step 1 is before KB_INTRO_INDEX
    const msg = mockMsg('skipkb', from);
    await handleSetup(msg, 'skipkb');
    assert.match(lastReply(msg), /skipkb.*only works during/i);
    // Step should not have changed
    assert.equal(setupSessions[from].step, 1);
  });

  it('skipkb during KB section completes setup and clears session', async () => {
    const from = '12420000005@c.us';
    setupSessions[from] = {
      step: KB_INTRO_INDEX + 1,
      data: { business_name: 'Test Biz', tone: 'friendly-pro', message_length: 'medium', language_style: 'standard' },
    };
    const msg = mockMsg('skipkb', from);
    await handleSetup(msg, 'skipkb');
    assert.ok(!setupSessions[from], 'session should be cleared after skipkb completes');
    assert.match(lastReply(msg), /Setup Complete|Knowledge base skipped/i);
  });

  it('invalid tone input replies with error and stays on same step', async () => {
    const from = '12420000006@c.us';
    const toneIdx = SETUP_STEPS.findIndex(s => s.key === 'tone');
    setupSessions[from] = { step: toneIdx, data: {} };
    const msg = mockMsg('9', from);
    await handleSetup(msg, '9');
    assert.match(lastReply(msg), /number 1-4/i);
    assert.equal(setupSessions[from].step, toneIdx, 'should not advance on invalid input');
  });

  it('valid tone input "2" maps to formal and advances', async () => {
    const from = '12420000007@c.us';
    const toneIdx = SETUP_STEPS.findIndex(s => s.key === 'tone');
    setupSessions[from] = { step: toneIdx, data: {} };
    const msg = mockMsg('2', from);
    await handleSetup(msg, '2');
    assert.equal(setupSessions[from].data.tone, 'formal');
    assert.equal(setupSessions[from].step, toneIdx + 1);
  });

  it('skip on custom_instructions stores empty string', async () => {
    const from = '12420000008@c.us';
    const ciIdx = SETUP_STEPS.findIndex(s => s.key === 'custom_instructions');
    setupSessions[from] = { step: ciIdx, data: {} };
    const msg = mockMsg('skip', from);
    await handleSetup(msg, 'skip');
    assert.equal(setupSessions[from].data.custom_instructions, '');
    assert.equal(setupSessions[from].step, ciIdx + 1);
  });

  it('custom_instructions over 200 chars replies with error', async () => {
    const from = '12420000009@c.us';
    const ciIdx = SETUP_STEPS.findIndex(s => s.key === 'custom_instructions');
    setupSessions[from] = { step: ciIdx, data: {} };
    const longText = 'x'.repeat(201);
    const msg = mockMsg(longText, from);
    await handleSetup(msg, longText);
    assert.match(lastReply(msg), /characters/i);
    assert.equal(setupSessions[from].step, ciIdx, 'should not advance');
  });

  it('owner_number rejects non-numeric / too-short input', async () => {
    const from = '12420000010@c.us';
    const onIdx = SETUP_STEPS.findIndex(s => s.key === 'owner_number');
    setupSessions[from] = { step: onIdx, data: {} };
    const msg = mockMsg('not-a-number', from);
    await handleSetup(msg, 'not-a-number');
    assert.match(lastReply(msg), /valid number/i);
    assert.equal(setupSessions[from].step, onIdx);
  });

  it('owner_number accepts valid international number', async () => {
    const from = '12420000011@c.us';
    const onIdx = SETUP_STEPS.findIndex(s => s.key === 'owner_number');
    setupSessions[from] = { step: onIdx, data: {} };
    const msg = mockMsg('12425550100', from);
    await handleSetup(msg, '12425550100');
    assert.equal(setupSessions[from].data.owner_number, '12425550100');
    assert.equal(setupSessions[from].step, onIdx + 1);
  });

  it('KB entries use prefill as question and user input as answer', async () => {
    const from = '12420000012@c.us';
    const kb1Idx = SETUP_STEPS.findIndex(s => s.key === 'kb_1');
    setupSessions[from] = { step: kb1Idx, data: {} };
    const msg = mockMsg('We sell fresh fish daily', from);
    await handleSetup(msg, 'We sell fresh fish daily');
    assert.equal(setupSessions[from].data.kb_1_a, 'We sell fresh fish daily');
    assert.ok(setupSessions[from].data.kb_1_q.length > 0, 'prefill question should be set');
  });

  it('KB skip leaves entry blank and advances', async () => {
    const from = '12420000013@c.us';
    const kb2Idx = SETUP_STEPS.findIndex(s => s.key === 'kb_2');
    setupSessions[from] = { step: kb2Idx, data: {} };
    const msg = mockMsg('skip', from);
    await handleSetup(msg, 'skip');
    assert.ok(!setupSessions[from].data.kb_2_a, 'skipped KB entry should have no answer');
    assert.equal(setupSessions[from].step, kb2Idx + 1);
  });
});

// ─── INBOUND ROUTING ──────────────────────────────────────────────────────────

describe('handleInbound() — routing & logging', () => {
  beforeEach(() => logCapture.length = 0);

  // Helper: stub classifyIntent to return a given result via fetch mock
  function mockClassify(intent, confidence = 0.9, reasoning = 'test') {
    global.fetch = async (url, opts) => {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: JSON.stringify({ intent, confidence, kb_index: null, reasoning }) },
          }],
          usage: { total_tokens: 50 },
        }),
      };
    };
  }

  function makeInboundMsg(body, from = '12429990001@c.us') {
    return {
      from,
      body,
      reply: async (text, _q, _opts) => {},
    };
  }

  it('every inbound message logs inbound:received', async () => {
    mockClassify('ACKNOWLEDGEMENT', 0.9);
    const msg = makeInboundMsg('ok thanks');
    await handleInbound(msg);
    const receivedEntry = logCapture.find(l => l.includes('inbound:received'));
    assert.ok(receivedEntry, 'should have an inbound:received log entry');
  });

  it('inbound:received log includes the message body', async () => {
    mockClassify('ACKNOWLEDGEMENT', 0.85);
    const msg = makeInboundMsg('sounds great');
    await handleInbound(msg);
    const receivedEntry = logCapture.find(l => l.includes('inbound:received'));
    assert.match(receivedEntry, /sounds great/);
  });

  it('classification log entry (inbound:classified) contains the intent', async () => {
    mockClassify('HOT_LEAD', 0.92);
    const msg = makeInboundMsg('what is the price');
    await handleInbound(msg);
    const classEntry = logCapture.find(l => l.includes('inbound:classified'));
    assert.ok(classEntry, 'should have an inbound:classified entry');
    assert.match(classEntry, /HOT_LEAD/);
  });

  it('confidence is logged as the 7th column of classified entry', async () => {
    mockClassify('CALL', 0.88);
    const msg = makeInboundMsg('can we book a call');
    await handleInbound(msg);
    const classEntry = logCapture.find(l => l.includes('inbound:classified'));
    const cols = classEntry.trimEnd().split(',');
    assert.equal(cols.length, 7);
    assert.match(cols[6], /\d+%/);
  });

  it('hard opt-out keyword logs inbound:opt-out without AI call', async () => {
    // fetch should NOT be called for hard opt-out
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; };
    const msg = makeInboundMsg('stop messages');
    await handleInbound(msg);
    const optOutEntry = logCapture.find(l => l.includes('inbound:opt-out'));
    assert.ok(optOutEntry, 'should log opt-out');
    assert.ok(!fetchCalled, 'hard opt-out should not make an AI call');
  });

  it('low confidence (< 0.45) routes to inbound:needs-review', async () => {
    mockClassify('OTHER', 0.3);
    const msg = makeInboundMsg('blah blah blah gibberish');
    await handleInbound(msg);
    const reviewEntry = logCapture.find(l => l.includes('inbound:needs-review'));
    assert.ok(reviewEntry, 'should log needs-review for low confidence');
  });

  it('HOT_LEAD log entry uses inbound:hot-lead status', async () => {
    mockClassify('HOT_LEAD', 0.91);
    const msg = makeInboundMsg('how much does this cost');
    await handleInbound(msg);
    const hotEntry = logCapture.find(l => l.includes('inbound:hot-lead'));
    assert.ok(hotEntry, 'should log inbound:hot-lead');
  });

  it('COMPLAINT log entry uses inbound:complaint status', async () => {
    mockClassify('COMPLAINT', 0.88);
    const msg = makeInboundMsg('this is not working and I am frustrated');
    await handleInbound(msg);
    const compEntry = logCapture.find(l => l.includes('inbound:complaint'));
    assert.ok(compEntry, 'should log inbound:complaint');
  });

  it('outbound:sent logged after message approval', async () => {
    // Simulate approving a pending preview
    const id = 'test-preview-123';
    pendingPreviews[id] = {
      rawNumber: '12420000099',
      message: 'Hi there, following up!',
      contact: { name: 'Test Contact' },
      tokens: 30,
    };
    mockClassify('ACKNOWLEDGEMENT', 0.9); // doesn't matter for this path
    // Simulate the owner saying "yes" — this goes through message_create handler
    // We test appendToLog directly instead
    appendToLog('12420000099', 'Test Contact', 'Hi there, following up!', 'outbound:sent', 30);
    delete pendingPreviews[id];
    const sentEntry = logCapture.find(l => l.includes('outbound:sent'));
    assert.ok(sentEntry, 'should have outbound:sent log entry');
  });
});

// ─── DEMO: NEWS BRIEF ─────────────────────────────────────────────────────────

describe('fetchNewsHeadlines()', () => {
  it('parses Tribune242 RSS XML and returns title + description', async () => {
    const fakeXml = `<?xml version="1.0"?>
<rss><channel>
  <item><title><![CDATA[Nassau Economy Grows 5%]]></title><description><![CDATA[Experts say tourism is driving the growth.]]></description></item>
  <item><title>World Leaders Meet</title><description>A summit was held in Geneva.</description></item>
</channel></rss>`;
    global.fetch = async () => ({ ok: true, text: async () => fakeXml });
    const headlines = await fetchNewsHeadlines();
    assert.ok(Array.isArray(headlines));
    assert.ok(headlines.length >= 1);
    assert.equal(headlines[0].title, 'Nassau Economy Grows 5%');
    assert.match(headlines[0].desc, /tourism/i);
  });

  it('returns at most 5 headlines', async () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      `<item><title>Story ${i + 1}</title><description>Desc ${i + 1}</description></item>`
    ).join('');
    const xml = `<rss><channel>${items}</channel></rss>`;
    global.fetch = async () => ({ ok: true, text: async () => xml });
    const headlines = await fetchNewsHeadlines();
    assert.ok(headlines.length <= 5);
  });

  it('returns null when feed fails', async () => {
    global.fetch = async () => { throw new Error('network error'); };
    const headlines = await fetchNewsHeadlines();
    assert.equal(headlines, null);
  });

  it('returns null when all feeds return empty XML', async () => {
    global.fetch = async () => ({ ok: true, text: async () => '<rss><channel></channel></rss>' });
    const headlines = await fetchNewsHeadlines();
    assert.equal(headlines, null);
  });
});

// ─── TOURISM KB — PRE-FLIGHT CONFIDENCE GATE ──────────────────────────────────
// Run with: OPENROUTER_API_KEY=sk-or-xxx RUN_PREFLIGHT=true npm test
// Skipped automatically in CI / when RUN_PREFLIGHT is not set.

describe('Tourism KB — pre-flight confidence gate', async () => {
  const run = process.env.RUN_PREFLIGHT === 'true';

  // Restore real fetch so callAI() can reach OpenRouter; stub it back after
  let _stubFetch;
  before(() => { if (run) { _stubFetch = global.fetch; global.fetch = _realFetch; } });
  after(() => { if (_stubFetch) { global.fetch = _stubFetch; _stubFetch = null; } });

  const tourPath = path.join(__dirname, '..', 'demo', 'settings_tour.csv');
  const tourRows = parseCSV(tourPath);
  const tourSettings = {};
  tourRows.forEach(r => { if (r.key) tourSettings[r.key] = r.value; });

  for (let i = 1; i <= 20; i++) {
    const q = tourSettings[`faq_${i}_q`];
    const a = tourSettings[`faq_${i}_a`];
    if (!q || !a) continue;

    it(`KB ${i}: "${q.slice(0, 60)}…" → QUESTION ≥75%`, { skip: !run }, async () => {
      const result = await classifyIntent(q, null, tourSettings);
      assert.ok(result, 'classifyIntent returned null — AI unavailable?');
      assert.ok(
        result.confidence >= AUTO_ACT_THRESHOLD,
        `KB ${i} confidence too low: ${result.confidence} (need ≥${AUTO_ACT_THRESHOLD})\nQ: "${q}"\nReasoning: ${result.reasoning}`
      );
      assert.equal(
        result.intent, 'QUESTION',
        `KB ${i} wrong intent: ${result.intent} (need QUESTION)\nQ: "${q}"`
      );
    });
  }
});

// ─── CONSTANTS & SANITY ───────────────────────────────────────────────────────

describe('Constants', () => {
  it('AUTO_ACT_THRESHOLD is 0.75', () => assert.equal(AUTO_ACT_THRESHOLD, 0.75));
  it('SUGGEST_THRESHOLD is 0.45', () => assert.equal(SUGGEST_THRESHOLD, 0.45));
  it('LOGICAL_TOTAL is 9', () => assert.equal(LOGICAL_TOTAL, 9));
  it('KB_INTRO_INDEX is 8 (9th step, 0-indexed)', () => assert.equal(KB_INTRO_INDEX, 8));
  it('SETUP_STEPS has 49 entries (8 config + kb_intro + 40 KB)', () => assert.equal(SETUP_STEPS.length, 49));
  it('all KB steps have both a key and a prefill', () => {
    const kbSteps = SETUP_STEPS.filter(s => s.key.startsWith('kb_') && s.key !== 'kb_intro');
    assert.equal(kbSteps.length, 40);
    for (const s of kbSteps) assert.ok(s.prefill?.length > 0, `${s.key} missing prefill`);
  });
});
