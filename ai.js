/* ============================================================
   Marginalia — AI assist
   Calls the Anthropic Messages API directly from the browser
   using a key the user supplies and stores locally. This site
   runs on its own (outside claude.ai), so it needs its own key.
   ============================================================ */
const AI_KEY_STORE = "marginalia_anthropic_key";
const AI_MODEL = "claude-sonnet-4-6";

function getApiKey() {
  return localStorage.getItem(AI_KEY_STORE) || "";
}

function setApiKey(key) {
  localStorage.setItem(AI_KEY_STORE, key.trim());
}

function clearApiKey() {
  localStorage.removeItem(AI_KEY_STORE);
}

async function testApiKey(key) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 8,
      messages: [{ role: "user", content: "Say hi." }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Request failed (${res.status})`);
  }
  return true;
}

/**
 * Ask the assistant for help with a piece of the manuscript.
 * @param {string} instruction - what the writer wants (draft/expand/rewrite/etc)
 * @param {string} context - relevant surrounding manuscript text
 * @returns {Promise<string>}
 */
async function askWritingAssistant(instruction, context) {
  const key = getApiKey();
  if (!key) {
    const e = new Error("NO_KEY");
    e.code = "NO_KEY";
    throw e;
  }

  const system = [
    "You are a skilled ghostwriter and developmental editor helping an author draft their ebook.",
    "Write in clean prose paragraphs only — no markdown headers, no bullet asterisks, no commentary about what you did.",
    "Match the tone and voice already established in the provided manuscript context, if any.",
    "Return only the requested text, ready to drop into the manuscript.",
  ].join(" ");

  const userContent = context
    ? `Manuscript context so far:\n"""\n${context.slice(-6000)}\n"""\n\nRequest: ${instruction}`
    : `Request: ${instruction}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 1400,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err?.error?.message || `Request failed (${res.status})`);
    e.code = res.status === 401 ? "BAD_KEY" : "REQUEST_FAILED";
    throw e;
  }

  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
