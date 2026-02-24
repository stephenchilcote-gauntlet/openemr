const SESSION_KEY = "openemr_agent_session_id"
const DEFAULT_PROXY_BASE = "/interface/modules/custom_modules/oe-module-clinical-assistant/public/proxy.php"
const MAX_CHARS = 8000
const WARN_CHARS = 7500

class SidebarApp {
  constructor() {
    this.state = {
      sessionID: sessionStorage.getItem(SESSION_KEY),
      phase: "ready",
      pendingManifest: null,
      patientID: null,
      encounterID: null,
      patientName: null,
      pendingMessages: false,
    }

    this.el = {
      statusPill: document.getElementById("status-pill"),
      statusText: document.getElementById("status-text"),
      contextLine: document.getElementById("context-line"),
      historySelect: document.getElementById("history-select"),
      newConversation: document.getElementById("new-conversation"),
      chatArea: document.getElementById("chat-area"),
      chatInput: document.getElementById("chat-input"),
      sendButton: document.getElementById("send-button"),
      charCounter: document.getElementById("char-counter"),
      newMessagesPill: document.getElementById("new-messages-pill"),
      reviewPanel: document.getElementById("review-panel"),
      reviewCards: document.getElementById("review-cards"),
      reviewSummary: document.getElementById("review-summary"),
      applyAll: document.getElementById("apply-all"),
      rejectAll: document.getElementById("reject-all"),
      executeButton: document.getElementById("execute-button"),
    }

    this.lastUserMessage = ""
  }

  async start() {
    this.bindEvents()
    this.refreshContext()
    await this.loadSessionList()

    if (this.state.sessionID) {
      const loaded = await this.loadConversation(this.state.sessionID)
      if (!loaded) {
        this.state.sessionID = null
        sessionStorage.removeItem(SESSION_KEY)
        this.renderSystemNotice("Your previous session expired. Starting a new conversation.")
      }
    }

    if (!this.state.sessionID) {
      await this.createSession()
    }
  }

  bindEvents() {
    this.el.newConversation.addEventListener("click", () => this.createSession(true))
    this.el.sendButton.addEventListener("click", () => this.sendMessage())
    this.el.historySelect.addEventListener("change", (event) => {
      const targetID = event.target.value
      if (targetID) {
        this.loadConversation(targetID)
      }
    })
    this.el.chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        this.sendMessage()
      }
    })
    this.el.chatInput.addEventListener("input", () => {
      this.resizeInput()
      this.updateCharacterCounter()
    })
    this.el.newMessagesPill.addEventListener("click", () => {
      this.scrollToBottom(true)
      this.el.newMessagesPill.classList.add("hidden")
    })
    this.el.applyAll.addEventListener("click", () => this.bulkReview("approved"))
    this.el.rejectAll.addEventListener("click", () => this.bulkReview("rejected"))
    this.el.executeButton.addEventListener("click", () => this.executeManifest())

    this.el.chatArea.addEventListener("scroll", () => {
      const nearBottom = this.isNearBottom()
      if (nearBottom) {
        this.el.newMessagesPill.classList.add("hidden")
        this.state.pendingMessages = false
      }
    })
  }

  refreshContext() {
    const globals = window.top || window
    const openemrGlobals = globals.openemrAgentContext || {}
    const patientID = openemrGlobals.pid || null
    const encounterID = openemrGlobals.encounter || null
    const patientName = openemrGlobals.patient_name || null

    this.state.patientID = patientID
    this.state.encounterID = encounterID
    this.state.patientName = patientName

    if (patientID) {
      const encounterText = encounterID ? ` | Encounter: ${encounterID}` : ""
      const nameText = patientName || patientID
      this.el.contextLine.textContent = `Patient: ${nameText}${encounterText}`
    } else {
      this.el.contextLine.textContent = "No patient selected"
    }
  }

  async api(path, options = {}) {
    const proxyBase = window.OPENEMR_AGENT_PROXY || DEFAULT_PROXY_BASE
    const separator = proxyBase.includes("?") ? "&" : "?"
    const url = `${proxyBase}${separator}path=${encodeURIComponent(path)}`
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    }
    const response = await fetch(url, { ...options, headers })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `HTTP ${response.status}`)
    }
    return response.json()
  }

  async createSession(clearChat = false) {
    try {
      const data = await this.api("/api/sessions", { method: "POST" })
      this.state.sessionID = data.session_id
      sessionStorage.setItem(SESSION_KEY, data.session_id)
      this.setStatus("ready")
      if (clearChat) {
        this.el.chatArea.innerHTML = ""
      }
      this.state.pendingManifest = null
      this.renderReviewPanel()
      await this.loadSessionList()
    } catch (error) {
      this.renderErrorBlock(`Failed to create a session: ${error.message}`)
      this.setStatus("error")
    }
  }

  async loadSessionList() {
    try {
      const sessions = await this.api("/api/sessions")
      this.el.historySelect.innerHTML = ""
      const placeholder = document.createElement("option")
      placeholder.value = ""
      placeholder.textContent = "Conversation history"
      this.el.historySelect.appendChild(placeholder)

      for (const session of sessions) {
        const option = document.createElement("option")
        option.value = session.session_id
        const patient = session.patient_name || session.patient_id || "No patient"
        option.textContent = `${session.first_message_preview || "(empty)"} · ${patient}`
        if (session.session_id === this.state.sessionID) {
          option.selected = true
        }
        this.el.historySelect.appendChild(option)
      }
    } catch (error) {
      this.renderErrorBlock(`Unable to load conversation history: ${error.message}`)
    }
  }

  async loadConversation(sessionID) {
    try {
      const data = await this.api(`/api/sessions/${sessionID}/messages`)
      this.state.sessionID = sessionID
      sessionStorage.setItem(SESSION_KEY, sessionID)
      this.el.chatArea.innerHTML = ""

      for (const message of data.messages || []) {
        this.renderMessage(message.role, message.content || "", null)
      }

      this.state.pendingManifest = data.manifest || null
      this.renderReviewPanel()
      this.scrollToBottom(true)
      return true
    } catch (_error) {
      return false
    }
  }

  buildPageContext() {
    this.refreshContext()
    return {
      patient_id: this.state.patientID,
      encounter_id: this.state.encounterID,
      page_type: window.location.pathname,
      visible_data: {
        patient_name: this.state.patientName,
      },
    }
  }

  async sendMessage(messageOverride = null) {
    const raw = messageOverride !== null ? messageOverride : this.el.chatInput.value
    const message = raw.trim()
    if (!message) {
      return
    }

    if (message.length > MAX_CHARS) {
      this.el.chatInput.title = "Message too long — shorten to under 8,000 characters."
      return
    }

    this.lastUserMessage = message
    this.renderMessage("user", message)
    this.el.chatInput.value = ""
    this.resizeInput()
    this.updateCharacterCounter()

    this.setStatus("thinking")
    this.toggleSend(false)
    const started = performance.now()

    try {
      const data = await this.api("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          session_id: this.state.sessionID,
          message,
          page_context: this.buildPageContext(),
        }),
      })

      this.state.sessionID = data.session_id
      sessionStorage.setItem(SESSION_KEY, data.session_id)

      const latencyMs = performance.now() - started
      this.renderMessage("assistant", data.response || "", {
        latencyMs,
        tools: data.tool_calls_summary || [],
      })

      this.state.pendingManifest = data.manifest || null
      this.renderReviewPanel()
      this.setStatus(this.phaseToStatus(data.phase))
      await this.loadSessionList()
    } catch (error) {
      this.renderRetryableError(error.message)
      this.setStatus("error")
    } finally {
      this.toggleSend(true)
      if (this.state.phase !== "reviewing") {
        this.setStatus("ready")
      }
    }
  }

  phaseToStatus(phase) {
    if (phase === "reviewing") {
      return "reviewing"
    }
    if (phase === "executing") {
      return "executing"
    }
    if (phase === "complete") {
      return "ready"
    }
    return "ready"
  }

  renderMessage(role, content, metadata = null) {
    const block = document.createElement("article")
    block.className = `message role-${role}`

    const markdown = document.createElement("div")
    markdown.className = "markdown"
    markdown.innerHTML = this.renderMarkdown(content)
    block.appendChild(markdown)

    if (metadata) {
      const meta = document.createElement("div")
      meta.className = "meta"
      const toolText = (metadata.tools || [])
        .map((tool) => `${tool.name} × ${tool.count}`)
        .join(", ")
      const latencyText = `${(metadata.latencyMs / 1000).toFixed(1)}s`
      meta.textContent = toolText ? `${latencyText} · ${toolText}` : latencyText
      block.appendChild(meta)

      if ((metadata.tools || []).length > 0) {
        const details = document.createElement("details")
        details.className = "activity"
        const summary = document.createElement("summary")
        summary.textContent = "Activity"
        details.appendChild(summary)
        const list = document.createElement("ul")
        for (const tool of metadata.tools) {
          const li = document.createElement("li")
          li.textContent = `✓ ${tool.name} called ${tool.count} time(s)`
          list.appendChild(li)
        }
        details.appendChild(list)
        block.appendChild(details)
      }
    }

    this.el.chatArea.appendChild(block)
    this.scrollToBottom()
  }

  renderRetryableError(text) {
    const block = document.createElement("div")
    block.className = "error-block"
    block.innerHTML = `<strong>Assistant error:</strong> ${this.escapeHtml(text)}`
    const retry = document.createElement("button")
    retry.className = "clickable"
    retry.textContent = "Retry"
    retry.addEventListener("click", () => {
      block.remove()
      if (this.lastUserMessage) {
        this.sendMessage(this.lastUserMessage)
      }
    })
    block.appendChild(document.createElement("br"))
    block.appendChild(retry)
    this.el.chatArea.appendChild(block)
    this.scrollToBottom()
  }

  renderErrorBlock(text) {
    const block = document.createElement("div")
    block.className = "error-block"
    block.textContent = text
    this.el.chatArea.appendChild(block)
  }

  renderSystemNotice(text) {
    this.renderMessage("assistant", text)
  }

  renderReviewPanel() {
    const manifest = this.state.pendingManifest
    if (!manifest || !Array.isArray(manifest.items) || manifest.items.length === 0) {
      this.el.reviewPanel.classList.add("hidden")
      return
    }

    this.el.reviewPanel.classList.remove("hidden")
    this.el.reviewCards.innerHTML = ""

    let approved = 0
    let rejected = 0
    let pending = 0

    for (const item of manifest.items) {
      if (item.status === "approved") {
        approved += 1
      } else if (item.status === "rejected") {
        rejected += 1
      } else {
        pending += 1
      }

      const card = document.createElement("article")
      card.className = "review-card"
      card.innerHTML = `
        <div><strong>${this.escapeHtml(item.resource_type)}</strong> · ${this.escapeHtml(item.action)}</div>
        <div>${this.escapeHtml(item.description || "No description")}</div>
      `

      const edit = document.createElement("textarea")
      edit.value = JSON.stringify(item.proposed_value || {}, null, 2)
      card.appendChild(edit)

      const actions = document.createElement("div")
      actions.className = "review-card-actions"
      actions.appendChild(this.makeReviewButton("Apply", () => this.updateReviewItem(item.id, "approved", edit.value)))
      actions.appendChild(this.makeReviewButton("Reject", () => this.updateReviewItem(item.id, "rejected", edit.value)))
      actions.appendChild(this.makeReviewButton("Undo", () => this.updateReviewItem(item.id, "pending", edit.value)))
      card.appendChild(actions)
      this.el.reviewCards.appendChild(card)
    }

    this.el.reviewSummary.textContent = `Apply: ${approved} | Rejected: ${rejected} | Pending: ${pending}`
    this.el.executeButton.textContent = approved > 0 ? "Execute Changes" : "Discard All"
  }

  makeReviewButton(label, onClick) {
    const button = document.createElement("button")
    button.className = "clickable"
    button.textContent = label
    button.addEventListener("click", onClick)
    return button
  }

  async updateReviewItem(itemID, status, proposedValueText) {
    if (!this.state.pendingManifest) {
      return
    }
    const approvedItems = []
    const rejectedItems = []
    const modifiedItems = []

    for (const item of this.state.pendingManifest.items) {
      if (item.id === itemID) {
        item.status = status
        try {
          const parsed = JSON.parse(proposedValueText)
          item.proposed_value = parsed
          modifiedItems.push({ id: item.id, proposed_value: parsed })
        } catch (_error) {
          this.renderErrorBlock("Invalid JSON in modified value.")
          return
        }
      }
      if (item.status === "approved") {
        approvedItems.push(item.id)
      }
      if (item.status === "rejected") {
        rejectedItems.push(item.id)
      }
    }

    try {
      await this.api(`/api/manifest/${this.state.sessionID}/approve`, {
        method: "POST",
        body: JSON.stringify({
          approved_items: approvedItems,
          rejected_items: rejectedItems,
          modified_items: modifiedItems,
        }),
      })
      this.renderReviewPanel()
    } catch (error) {
      this.renderErrorBlock(`Failed to update manifest review: ${error.message}`)
    }
  }

  async bulkReview(status) {
    if (!this.state.pendingManifest) {
      return
    }
    for (const item of this.state.pendingManifest.items) {
      item.status = status
    }
    this.renderReviewPanel()
    await this.updateReviewItem(this.state.pendingManifest.items[0].id, status, JSON.stringify(this.state.pendingManifest.items[0].proposed_value || {}))
  }

  async executeManifest() {
    if (!this.state.pendingManifest) {
      return
    }
    const approved = this.state.pendingManifest.items.filter((item) => item.status === "approved")
    if (approved.length === 0) {
      this.state.pendingManifest = null
      this.renderReviewPanel()
      this.setStatus("ready")
      return
    }

    this.setStatus("executing")
    this.toggleSend(false)
    try {
      const data = await this.api(`/api/manifest/${this.state.sessionID}/execute`, { method: "POST" })
      this.renderSystemNotice(`Execution finished: ${data.manifest_status || "completed"}.`)
      this.state.pendingManifest = null
      this.renderReviewPanel()
      this.setStatus("ready")
    } catch (error) {
      this.renderErrorBlock(`Execution failed: ${error.message}`)
      this.setStatus("error")
    } finally {
      this.toggleSend(true)
    }
  }

  resizeInput() {
    this.el.chatInput.style.height = "auto"
    const next = Math.min(this.el.chatInput.scrollHeight, 130)
    this.el.chatInput.style.height = `${next}px`
  }

  updateCharacterCounter() {
    const count = this.el.chatInput.value.length
    this.el.charCounter.textContent = `${count} / ${MAX_CHARS}`
    const show = count >= WARN_CHARS
    this.el.charCounter.classList.toggle("hidden", !show)
    const overLimit = count > MAX_CHARS
    this.el.chatInput.classList.toggle("over-limit", overLimit)
    this.el.sendButton.disabled = overLimit || this.el.sendButton.disabled
    this.el.sendButton.title = overLimit
      ? "Message too long — shorten to under 8,000 characters."
      : ""
  }

  setStatus(state) {
    this.state.phase = state
    const textMap = {
      ready: "Ready",
      thinking: "Thinking…",
      reviewing: "Review Changes",
      executing: "Applying…",
      error: "Error",
    }
    this.el.statusPill.dataset.state = state
    this.el.statusText.textContent = textMap[state] || textMap.ready
  }

  toggleSend(enabled) {
    const overLimit = this.el.chatInput.value.length > MAX_CHARS
    this.el.sendButton.disabled = !enabled || overLimit
    if (!enabled) {
      this.el.sendButton.title = "Waiting for the assistant to finish."
    } else if (!overLimit) {
      this.el.sendButton.title = ""
    }
  }

  isNearBottom() {
    const target = this.el.chatArea
    return target.scrollHeight - target.scrollTop - target.clientHeight <= 50
  }

  scrollToBottom(force = false) {
    const shouldScroll = force || this.isNearBottom()
    if (shouldScroll) {
      this.el.chatArea.scrollTop = this.el.chatArea.scrollHeight
      this.el.newMessagesPill.classList.add("hidden")
      this.state.pendingMessages = false
      return
    }
    this.state.pendingMessages = true
    this.el.newMessagesPill.classList.remove("hidden")
  }

  renderMarkdown(text) {
    let rendered = this.escapeHtml(text || "")
    rendered = rendered.replace(/`([^`]+)`/g, "<code>$1</code>")
    rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    rendered = rendered.replace(/\*([^*]+)\*/g, "<em>$1</em>")
    rendered = rendered.replace(/\n/g, "<br>")
    rendered = rendered.replace(
      /\b([A-Z][A-Za-z]+\/[A-Za-z0-9\-\.]+)\b/g,
      "<code>$1</code>"
    )
    return rendered
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;")
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const app = new SidebarApp()
  app.start()
})
