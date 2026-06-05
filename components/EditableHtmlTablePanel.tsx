"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  content: string;
  onSave: (next: string) => Promise<void>;
}

interface Cell {
  text: string;
  style: string;
}

interface Row {
  id: string;
  style: string;
  cells: Cell[];
}

interface TableModel {
  rootTag: string; // e.g. "div"
  rootAttrs: string; // raw attribute string of the wrapper, e.g. ' style="..."'
  tableAttrs: string;
  theadAttrs: string;
  trHeadAttrs: string;
  headers: Cell[];
  tbodyAttrs: string;
  rows: Row[];
  // Template styles for newly added rows.
  defaultTrStyle: string;
  defaultCellStyles: string[];
}

interface EditingCell {
  rowId: string | "__head";
  colIdx: number;
}

let _seq = 0;
function rowId(): string {
  _seq += 1;
  return `r${Date.now().toString(36)}_${_seq}`;
}

/**
 * Inline-editable comparison-table panel (Phase 2d).
 *
 * Parses panel.content into a structured TableModel and renders the table
 * directly (no iframe), so we can attach React event handlers per cell + row.
 * Per-row controls: ↑, ↓, ×. Bottom: + Add row. Click any cell to edit.
 *
 * Falls back to a read-only `dangerouslySetInnerHTML` block if the content
 * doesn't contain a parseable <table>.
 *
 * Saves happen on commit (add/remove/reorder rows immediately; cell text on
 * blur/Enter). On failure, the model snapshots back to pre-edit state.
 */
export function EditableHtmlTablePanel({ content, onSave }: Props) {
  // Initial state is null so the very first render (server + client hydration)
  // shows the read-only fallback — that matches server-rendered HTML exactly.
  // parseTable can't run on the server (no DOMParser) so any other initial
  // value here would diverge between server and client and break hydration.
  const [model, setModel] = useState<TableModel | null>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate the model on mount and whenever content changes from outside.
  // lastContentRef starts as null so the first run after mount actually parses.
  const lastContentRef = useRef<string | null>(null);
  const lastSerializedRef = useRef<string | null>(null);
  useEffect(() => {
    if (content === lastContentRef.current) return;
    lastContentRef.current = content;
    if (content === lastSerializedRef.current) return;
    setModel(parseTable(content));
    setEditing(null);
  }, [content]);

  if (!model) {
    // Couldn't find a table — render the raw HTML read-only. The user keeps
    // their data; they just can't edit it inline.
    return (
      <div
        className="panel-html-fallback"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  async function commit(next: TableModel) {
    const prev = model;
    setModel(next);
    setSaving(true);
    setError(null);
    const serialized = serializeTable(next);
    lastSerializedRef.current = serialized;
    try {
      await onSave(serialized);
    } catch (e) {
      lastSerializedRef.current = null;
      setModel(prev);
      setError((e as Error).message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(rowId: string | "__head", colIdx: number, value: string) {
    if (saving) return;
    setEditing({ rowId, colIdx });
    setDraft(value);
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function commitEdit() {
    if (!editing || !model) return;
    const trimmed = draft.replace(/\s+/g, " ").trim();
    if (editing.rowId === "__head") {
      const orig = model.headers[editing.colIdx]?.text ?? "";
      if (trimmed === orig.trim()) {
        setEditing(null);
        return;
      }
      const next: TableModel = {
        ...model,
        headers: model.headers.map((c, i) =>
          i === editing.colIdx ? { ...c, text: trimmed } : c
        ),
      };
      setEditing(null);
      await commit(next);
      return;
    }
    const row = model.rows.find((r) => r.id === editing.rowId);
    if (!row) {
      setEditing(null);
      return;
    }
    const orig = row.cells[editing.colIdx]?.text ?? "";
    if (trimmed === orig.trim()) {
      setEditing(null);
      return;
    }
    const next: TableModel = {
      ...model,
      rows: model.rows.map((r) =>
        r.id === editing.rowId
          ? {
              ...r,
              cells: r.cells.map((c, i) =>
                i === editing.colIdx ? { ...c, text: trimmed } : c
              ),
            }
          : r
      ),
    };
    setEditing(null);
    await commit(next);
  }

  async function addRow() {
    if (saving || !model) return;
    const cells: Cell[] = model.headers.map((_, i) => ({
      text: "",
      style: model.defaultCellStyles[i] ?? "",
    }));
    const next: TableModel = {
      ...model,
      rows: [
        ...model.rows,
        { id: rowId(), style: model.defaultTrStyle, cells },
      ],
    };
    await commit(next);
  }

  async function deleteRow(id: string) {
    if (saving || !model) return;
    if (!window.confirm("Delete this row?")) return;
    const next: TableModel = {
      ...model,
      rows: model.rows.filter((r) => r.id !== id),
    };
    await commit(next);
  }

  async function moveRow(id: string, direction: -1 | 1) {
    if (saving || !model) return;
    const idx = model.rows.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const target = idx + direction;
    if (target < 0 || target >= model.rows.length) return;
    const rows = [...model.rows];
    [rows[idx], rows[target]] = [rows[target], rows[idx]];
    const next: TableModel = { ...model, rows };
    await commit(next);
  }

  function onCellKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    }
  }

  // Visible model — during cell edit, leave the original text in place; the
  // textarea floats over it. (Simpler than swapping cells inline.)
  return (
    <div className="relative" style={parseStyle(model.rootAttrs)}>
      <table style={parseStyle(model.tableAttrs)}>
        <thead style={parseStyle(model.theadAttrs)}>
          <tr style={parseStyle(model.trHeadAttrs)}>
            {model.headers.map((h, i) => {
              const isEditing =
                editing?.rowId === "__head" && editing.colIdx === i;
              return (
                <th
                  key={`h-${i}`}
                  style={{ ...parseStyle(h.style), position: "relative" }}
                  onClick={() => startEdit("__head", i, h.text)}
                  className="cursor-text"
                >
                  {isEditing ? (
                    <EditOverlay
                      value={draft}
                      onChange={setDraft}
                      onCommit={commitEdit}
                      onKeyDown={onCellKey}
                      disabled={saving}
                    />
                  ) : (
                    h.text
                  )}
                </th>
              );
            })}
            <th
              aria-hidden
              style={{ width: 1, padding: 0, background: "transparent" }}
            />
          </tr>
        </thead>
        <tbody style={parseStyle(model.tbodyAttrs)}>
          {model.rows.map((r, ri) => (
            <tr key={r.id} style={parseStyle(r.style)} className="group/row">
              {r.cells.map((c, ci) => {
                const isEditing =
                  editing?.rowId === r.id && editing.colIdx === ci;
                return (
                  <td
                    key={`${r.id}-${ci}`}
                    style={{ ...parseStyle(c.style), position: "relative" }}
                    onClick={() => startEdit(r.id, ci, c.text)}
                    className="cursor-text"
                  >
                    {isEditing ? (
                      <EditOverlay
                        value={draft}
                        onChange={setDraft}
                        onCommit={commitEdit}
                        onKeyDown={onCellKey}
                        disabled={saving}
                      />
                    ) : (
                      c.text || (
                        <span className="text-ink-faint italic">empty</span>
                      )
                    )}
                  </td>
                );
              })}
              <td
                style={{
                  width: 1,
                  padding: 0,
                  background: "transparent",
                  whiteSpace: "nowrap",
                }}
                className="pl-2"
              >
                <div className="invisible flex items-center gap-1 group-hover/row:visible">
                  <RowButton
                    onClick={() => moveRow(r.id, -1)}
                    disabled={saving || ri === 0}
                    title="Move up"
                  >
                    ↑
                  </RowButton>
                  <RowButton
                    onClick={() => moveRow(r.id, 1)}
                    disabled={saving || ri === model.rows.length - 1}
                    title="Move down"
                  >
                    ↓
                  </RowButton>
                  <RowButton
                    onClick={() => deleteRow(r.id)}
                    disabled={saving}
                    title="Delete row"
                    danger
                  >
                    ×
                  </RowButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          disabled={saving}
          className="rounded-md border border-paper-line bg-paper px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-ink-muted disabled:cursor-not-allowed disabled:text-ink-faint"
        >
          + Add row
        </button>
        {saving && (
          <span className="font-mono text-[11px] text-ink-faint">saving…</span>
        )}
        {error && (
          <span role="alert" className="text-[11px] text-red-600">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- subcomponents ----------

function RowButton({
  onClick,
  disabled,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={
        "inline-flex h-6 w-6 items-center justify-center rounded-md border border-paper-line bg-white text-xs leading-none transition-colors hover:border-ink-muted disabled:cursor-not-allowed disabled:opacity-40 " +
        (danger
          ? "text-red-700 hover:bg-red-50 hover:border-red-300"
          : "text-ink-soft")
      }
    >
      {children}
    </button>
  );
}

function EditOverlay({
  value,
  onChange,
  onCommit,
  onKeyDown,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
}) {
  return (
    <textarea
      autoFocus
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={onKeyDown}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      aria-label="Edit cell"
      className="w-full resize-none bg-white text-inherit"
      style={{
        font: "inherit",
        color: "inherit",
        border: "1px solid rgba(31,151,220,0.7)",
        outline: "2px solid rgba(31,151,220,0.2)",
        borderRadius: 3,
        padding: "2px 4px",
        margin: "-2px -4px",
        minHeight: "1.4em",
      }}
    />
  );
}

// ---------- parse + serialize ----------

/**
 * Convert an HTML-style attribute string to a React inline-style object.
 * Returns {} if no style attribute found.
 */
function parseStyle(rawAttrs: string): React.CSSProperties {
  const m = rawAttrs.match(/style="([^"]*)"/i);
  if (!m) return {};
  const css = m[1];
  const out: Record<string, string> = {};
  css.split(";").forEach((decl) => {
    const idx = decl.indexOf(":");
    if (idx === -1) return;
    const prop = decl.slice(0, idx).trim();
    const val = decl.slice(idx + 1).trim();
    if (!prop || !val) return;
    const reactProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[reactProp] = val;
  });
  return out as React.CSSProperties;
}

function attrString(el: Element): string {
  const out: string[] = [];
  for (const a of Array.from(el.attributes)) {
    out.push(`${a.name}="${escapeAttr(a.value)}"`);
  }
  return out.length ? " " + out.join(" ") : "";
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeText(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseTable(content: string): TableModel | null {
  if (typeof window === "undefined" || !content) return null;
  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${content}</body></html>`,
    "text/html"
  );
  const body = doc.body;
  if (!body) return null;
  const table = body.querySelector("table");
  if (!table) return null;

  // Root wrapper — prefer body's first child if it's a wrapping element,
  // otherwise wrap the table itself as the root.
  const first = body.firstElementChild;
  const rootEl =
    first && first !== table && first.contains(table) ? first : table;
  const rootTag = rootEl.tagName.toLowerCase();
  const rootAttrs = attrString(rootEl);

  const tableAttrs = attrString(table);

  const thead = table.querySelector("thead");
  const theadAttrs = thead ? attrString(thead) : "";
  // First row of thead (or first row of table if no thead) is the header.
  const headerRow =
    (thead && thead.querySelector("tr")) ||
    table.querySelector("tr") ||
    null;
  if (!headerRow) return null;
  const trHeadAttrs = attrString(headerRow);
  const headerCells = Array.from(headerRow.querySelectorAll("th, td"));
  if (headerCells.length === 0) return null;
  const headers: Cell[] = headerCells.map((c) => ({
    text: (c.textContent || "").trim(),
    style: attrString(c),
  }));

  const tbody = table.querySelector("tbody");
  const tbodyAttrs = tbody ? attrString(tbody) : "";
  // Body rows = tbody rows; if no tbody, all <tr>s after the header.
  const allRows = Array.from(table.querySelectorAll("tr"));
  const bodyRowEls = tbody
    ? Array.from(tbody.querySelectorAll("tr"))
    : allRows.slice(1);

  const rows: Row[] = bodyRowEls.map((tr) => ({
    id: rowId(),
    style: attrString(tr),
    cells: Array.from(tr.querySelectorAll("td, th")).map((c) => ({
      text: (c.textContent || "").trim(),
      style: attrString(c),
    })),
  }));

  // Default styles for new rows: copy from the last body row, or use minimal
  // padding if there are none.
  const lastRow = bodyRowEls[bodyRowEls.length - 1];
  const defaultTrStyle = lastRow
    ? attrString(lastRow)
    : ` style="border-top:1px solid #e3e1d8;"`;
  const defaultCellStyles = lastRow
    ? Array.from(lastRow.querySelectorAll("td, th")).map((c) => attrString(c))
    : headers.map(() => ` style="padding:8px 10px; vertical-align:top;"`);

  // Normalize: ensure every row has the same column count as headers.
  rows.forEach((r) => {
    while (r.cells.length < headers.length) {
      r.cells.push({
        text: "",
        style:
          defaultCellStyles[r.cells.length] ??
          ` style="padding:8px 10px;"`,
      });
    }
    r.cells.length = headers.length;
  });

  return {
    rootTag,
    rootAttrs,
    tableAttrs,
    theadAttrs,
    trHeadAttrs,
    headers,
    tbodyAttrs,
    rows,
    defaultTrStyle,
    defaultCellStyles,
  };
}

function serializeTable(m: TableModel): string {
  const headersHtml = m.headers
    .map((c) => `<th${c.style}>${escapeText(c.text)}</th>`)
    .join("");
  const theadOpen = m.theadAttrs
    ? `<thead${m.theadAttrs}>`
    : "<thead>";
  const tbodyOpen = m.tbodyAttrs
    ? `<tbody${m.tbodyAttrs}>`
    : "<tbody>";

  const rowsHtml = m.rows
    .map((r) => {
      const cells = r.cells
        .map((c) => `<td${c.style}>${escapeText(c.text)}</td>`)
        .join("");
      return `<tr${r.style}>${cells}</tr>`;
    })
    .join("");

  const tableHtml =
    `<table${m.tableAttrs}>` +
    theadOpen +
    `<tr${m.trHeadAttrs}>${headersHtml}</tr>` +
    `</thead>` +
    tbodyOpen +
    rowsHtml +
    `</tbody>` +
    `</table>`;

  if (m.rootTag === "table") return tableHtml;
  return `<${m.rootTag}${m.rootAttrs}>${tableHtml}</${m.rootTag}>`;
}
