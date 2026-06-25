const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

const SYSTEM_PROMPT = `You are the IT Help Desk Assistant for an internal company support system.
You help employees with:
- General IT troubleshooting (password resets, common software/hardware issues, network problems)
- Explaining how to use the help desk system (creating tickets, checking status, adding comments)
- Answering questions about the employee's own tickets, using the context provided below

Rules:
- Only discuss the requesting employee's own tickets. Never reveal information about other employees or other people's tickets.
- If asked about something outside IT support or the help desk system, politely redirect to IT-related topics.
- If you don't have enough information to answer (e.g. the ticket isn't in the context provided), tell the user to check the Tickets page or open a new ticket, rather than guessing.
- Keep answers concise and practical. Use plain language, not corporate jargon.
- If a question implies a new issue (not an existing ticket), suggest they create a new ticket via "+ New Ticket" and offer to help them describe it clearly.`;

// Build a compact text summary of the employee's own tickets for context
async function buildTicketContext(userId) {
  const [tickets] = await db.query(
    `SELECT t.id, t.reference_no, t.title, t.description, t.created_at, t.due_date, t.resolved_at,
            c.name AS category, p.name AS priority, s.name AS status,
            assignee.full_name AS assigned_to_name
     FROM tickets t
     JOIN categories c ON t.category_id = c.id
     JOIN priorities p ON t.priority_id = p.id
     JOIN statuses   s ON t.status_id   = s.id
     LEFT JOIN users assignee ON t.assigned_to = assignee.id
     WHERE t.created_by = ?
     ORDER BY t.created_at DESC
     LIMIT 25`,
    [userId]
  );

  if (tickets.length === 0) {
    return { text: "This employee has not created any tickets yet.", tickets: [] };
  }

  const ticketIds = tickets.map((t) => t.id);
  let commentsByTicket = {};
  if (ticketIds.length > 0) {
    const placeholders = ticketIds.map(() => "?").join(",");
    const [comments] = await db.query(
      `SELECT tc.ticket_id, tc.body, tc.created_at, u.full_name AS author_name
       FROM ticket_comments tc
       JOIN users u ON tc.author_id = u.id
       WHERE tc.ticket_id IN (${placeholders}) AND tc.is_internal = 0
       ORDER BY tc.created_at DESC`,
      ticketIds
    );
    for (const c of comments) {
      if (!commentsByTicket[c.ticket_id]) commentsByTicket[c.ticket_id] = [];
      if (commentsByTicket[c.ticket_id].length < 3) {
        commentsByTicket[c.ticket_id].push(c);
      }
    }
  }

  const lines = tickets.map((t) => {
    const recent = (commentsByTicket[t.id] || [])
      .map((c) => `    - ${c.author_name}: ${c.body.slice(0, 200)}`)
      .join("\n");
    return [
      `Ticket ${t.reference_no}: "${t.title}"`,
      `  Status: ${t.status} | Priority: ${t.priority} | Category: ${t.category}`,
      `  Assigned to: ${t.assigned_to_name || "Unassigned"}`,
      `  Created: ${new Date(t.created_at).toLocaleDateString()}` +
        (t.due_date ? ` | Due: ${new Date(t.due_date).toLocaleDateString()}` : "") +
        (t.resolved_at ? ` | Resolved: ${new Date(t.resolved_at).toLocaleDateString()}` : ""),
      `  Description: ${t.description.slice(0, 300)}`,
      recent ? `  Recent comments:\n${recent}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return {
    text: `Here are this employee's tickets:\n\n${lines.join("\n\n")}`,
    tickets,
  };
}

// ─── MOCK FALLBACK ──────────────────────────────────────────
// Generates a context-aware canned response when the real API is unavailable
// (no key, invalid key, or no billing/credits). Lets the rest of the flow
// (ticket lookup, frontend rendering, history) be tested without API cost.
function mockReply(message, tickets) {
  const msg = message.toLowerCase();

  if (tickets.length === 0) {
    return "I don't see any tickets under your account yet. You can create one using the \"+ New Ticket\" button, and I'll be able to help you track it once it exists.\n\n(🧪 Mock mode — connect a valid Anthropic API key with billing enabled for live responses.)";
  }

  // Try to match a reference number mentioned in the message, e.g. HD-2024-001
  const refMatch = message.match(/[A-Z]{2,}-\d{4,}-\d+/i);
  let matchedTicket = null;
  if (refMatch) {
    matchedTicket = tickets.find(
      (t) => t.reference_no.toLowerCase() === refMatch[0].toLowerCase()
    );
  }

  if (matchedTicket) {
    return [
      `Here's what I have for ${matchedTicket.reference_no}:`,
      `• Title: ${matchedTicket.title}`,
      `• Status: ${matchedTicket.status}`,
      `• Priority: ${matchedTicket.priority}`,
      `• Assigned to: ${matchedTicket.assigned_to_name || "Unassigned"}`,
      ``,
      `(🧪 Mock mode — connect a valid Anthropic API key with billing enabled for live, conversational responses.)`,
    ].join("\n");
  }

  if (msg.includes("status") || msg.includes("update")) {
    const list = tickets
      .slice(0, 5)
      .map((t) => `• ${t.reference_no} — ${t.title} (${t.status})`)
      .join("\n");
    return `Here are your most recent tickets:\n\n${list}\n\n(🧪 Mock mode — ask me about a specific ticket number for more detail once live API access is connected.)`;
  }

  if (msg.includes("new ticket") || msg.includes("create") || msg.includes("submit")) {
    return "To submit a new ticket, click \"+ New Ticket\" from your dashboard or the Tickets page. Include a clear title, what you were doing when the issue happened, and any error messages you saw — that helps the IT team resolve it faster.\n\n(🧪 Mock mode — live AI responses will be more tailored once API billing is set up.)";
  }

  return `I'm currently running in mock mode (no live AI connection), so I can only give basic answers. You have ${tickets.length} ticket${tickets.length !== 1 ? "s" : ""} on file — ask me about a specific one by its reference number, or check the Tickets page for full details.\n\n(🧪 Mock mode — connect a valid Anthropic API key with billing enabled for full conversational responses.)`;
}

// ─── POST /api/ai/chat ─────────────────────────────────────
// body: { message: string, history?: [{role, content}] }
router.post("/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    const { text: ticketContextText, tickets } = await buildTicketContext(req.user.id);

    const trimmedHistory = Array.isArray(history)
      ? history
          .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
          .slice(-10)
      : [];

    const messages = [
      ...trimmedHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    // No key at all -> straight to mock, don't bother calling out
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ success: true, reply: mockReply(message, tickets), mock: true });
    }

    let response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          system: `${SYSTEM_PROMPT}\n\n${ticketContextText}`,
          messages,
        }),
      });
    } catch (networkErr) {
      console.error("Anthropic API network error, falling back to mock:", networkErr);
      return res.json({ success: true, reply: mockReply(message, tickets), mock: true });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);

      // Auth (401) or invalid request / billing (400/403) -> fall back to mock
      // so the rest of the app stays usable while credentials/billing get sorted.
      if ([401, 400, 403].includes(response.status)) {
        return res.json({ success: true, reply: mockReply(message, tickets), mock: true });
      }

      return res.status(502).json({ success: false, message: "AI service error. Please try again." });
    }

    const data = await response.json();
    const reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return res.json({ success: true, reply, mock: false });
  } catch (err) {
    console.error("AI chat error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;