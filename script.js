const input = document.querySelector("#jsonInput");
const treeView = document.querySelector("#treeView");
const statusText = document.querySelector("#jsonStatus");
const errorBox = document.querySelector("#errorBox");
const summary = document.querySelector("#treeSummary");
const searchInput = document.querySelector("#searchInput");
const searchCount = document.querySelector("#searchCount");
const themeButton = document.querySelector("#themeButton");

const examples = {
  api: {
    requestId: "req_88421",
    status: "success",
    user: {
      id: 42,
      name: "Ana Lima",
      email: "ana@example.com",
      roles: ["admin", "editor"],
      active: true
    },
    metrics: {
      visits: 1284,
      conversionRate: 0.084,
      lastLogin: "2026-06-18T14:22:00Z"
    },
    notifications: [
      { type: "billing", unread: false },
      { type: "security", unread: true }
    ]
  },
  config: {
    app: "JSON Visualizer",
    version: "1.0.0",
    features: {
      formatOnSave: true,
      theme: "system",
      maxFileSizeMb: 5
    },
    endpoints: {
      production: "https://api.example.com",
      staging: "https://staging.example.com"
    },
    retries: 3,
    fallback: null
  },
  catalog: {
    store: "Northwind Digital",
    currency: "BRL",
    categories: [
      {
        name: "Livros",
        items: [
          { sku: "BK-101", title: "Clean Code", price: 129.9, stock: 12 },
          { sku: "BK-205", title: "Domain-Driven Design", price: 189.5, stock: 4 }
        ]
      },
      {
        name: "Acessórios",
        items: [
          { sku: "AC-300", title: "Teclado mecânico", price: 349.0, stock: 8 }
        ]
      }
    ]
  }
};

let parsedJson = examples.api;
let expandedPaths = new Set(["root"]);
let currentSearch = "";

function init() {
  input.value = stringify(parsedJson, 2);
  const storedTheme = localStorage.getItem("json-visualizer-theme");
  setTheme(storedTheme || "light");
  bindEvents();
  parseAndRender();
}

function bindEvents() {
  input.addEventListener("input", parseAndRender);
  searchInput.addEventListener("input", () => {
    currentSearch = searchInput.value.trim().toLowerCase();
    renderTree();
  });

  document.querySelector("#formatButton").addEventListener("click", () => {
    const result = safeParse(input.value);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    input.value = stringify(result.value, 2);
    parseAndRender();
  });

  document.querySelector("#minifyButton").addEventListener("click", () => {
    const result = safeParse(input.value);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    input.value = JSON.stringify(result.value);
    parseAndRender();
  });

  document.querySelector("#clearButton").addEventListener("click", () => {
    input.value = "";
    parsedJson = null;
    expandedPaths = new Set(["root"]);
    parseAndRender();
    input.focus();
  });

  document.querySelector("#expandAllButton").addEventListener("click", () => {
    if (parsedJson === null) return;
    expandedPaths = collectContainerPaths(parsedJson);
    renderTree();
  });

  document.querySelector("#collapseAllButton").addEventListener("click", () => {
    expandedPaths = new Set(["root"]);
    renderTree();
  });

  themeButton.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  });

  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const example = examples[button.dataset.example];
      parsedJson = example;
      input.value = stringify(example, 2);
      expandedPaths = new Set(["root"]);
      parseAndRender();
    });
  });
}

function parseAndRender() {
  if (!input.value.trim()) {
    parsedJson = null;
    statusText.textContent = "Aguardando JSON";
    statusText.className = "status";
    errorBox.className = "error-box";
    errorBox.textContent = "Sem conteúdo.";
    summary.textContent = "0 nós";
    searchCount.textContent = "0 resultados";
    treeView.innerHTML = '<div class="tree-empty">Nenhum JSON carregado.</div>';
    return;
  }

  const result = safeParse(input.value);
  if (!result.ok) {
    parsedJson = null;
    showError(result.error);
    summary.textContent = "0 nós";
    searchCount.textContent = "0 resultados";
    treeView.innerHTML = '<div class="tree-empty">Corrija o erro para renderizar a árvore.</div>';
    return;
  }

  parsedJson = result.value;
  statusText.textContent = "JSON válido";
  statusText.className = "status valid";
  errorBox.className = "error-box";
  errorBox.textContent = "Sem erros encontrados.";
  renderTree();
}

function safeParse(value) {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    return { ok: false, error };
  }
}

function showError(error) {
  const position = extractErrorPosition(error.message);
  const location = position ? getLineColumn(input.value, position) : null;
  const place = location ? ` Linha ${location.line}, coluna ${location.column}.` : "";
  statusText.textContent = "JSON inválido";
  statusText.className = "status invalid";
  errorBox.className = "error-box has-error";
  errorBox.textContent = `${error.message}.${place}`;
}

function renderTree() {
  if (parsedJson === null) return;
  const stats = { nodes: 0, matches: 0 };
  const tree = createNode(parsedJson, "root", "root", stats);
  treeView.replaceChildren(tree);
  summary.textContent = `${stats.nodes} ${stats.nodes === 1 ? "nó" : "nós"}`;
  searchCount.textContent = `${stats.matches} ${stats.matches === 1 ? "resultado" : "resultados"}`;
}

function createNode(value, key, path, stats) {
  stats.nodes += 1;
  const isContainer = isObject(value) || Array.isArray(value);
  const isExpanded = expandedPaths.has(path);
  const node = document.createElement("div");
  node.className = "tree-node";

  const row = document.createElement("div");
  row.className = "node-row";

  const match = matchesSearch(key, value);
  if (match) {
    row.classList.add("match");
    stats.matches += 1;
  }

  if (isContainer) {
    const toggle = document.createElement("button");
    toggle.className = "toggle";
    toggle.type = "button";
    toggle.textContent = isExpanded ? "▾" : "▸";
    toggle.title = isExpanded ? "Recolher nó" : "Expandir nó";
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.addEventListener("click", () => {
      if (expandedPaths.has(path)) {
        expandedPaths.delete(path);
      } else {
        expandedPaths.add(path);
      }
      renderTree();
    });
    row.appendChild(toggle);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "spacer";
    row.appendChild(spacer);
  }

  row.appendChild(labelFor(key, path === "root"));
  row.appendChild(valuePreview(value, isContainer));
  node.appendChild(row);

  if (isContainer && isExpanded) {
    const children = document.createElement("div");
    children.className = "children";
    Object.entries(value).forEach(([childKey, childValue]) => {
      children.appendChild(createNode(childValue, childKey, `${path}.${escapePath(childKey)}`, stats));
    });
    node.appendChild(children);
  }

  return node;
}

function labelFor(key, isRoot) {
  const span = document.createElement("span");
  span.className = "key";
  span.innerHTML = isRoot ? "root" : `${highlight(String(key))}:`;
  return span;
}

function valuePreview(value, isContainer) {
  const span = document.createElement("span");
  if (Array.isArray(value)) {
    span.className = "meta";
    span.textContent = `Array(${value.length})`;
    return span;
  }
  if (isObject(value)) {
    span.className = "meta";
    const size = Object.keys(value).length;
    span.textContent = `Object(${size})`;
    return span;
  }

  const type = value === null ? "null" : typeof value;
  span.className = type;
  if (typeof value === "string") {
    span.innerHTML = `"${highlight(value)}"`;
  } else {
    span.innerHTML = highlight(String(value));
  }
  return span;
}

function matchesSearch(key, value) {
  if (!currentSearch) return false;
  const keyHit = String(key).toLowerCase().includes(currentSearch);
  if (keyHit) return true;
  if (isObject(value) || Array.isArray(value)) return false;
  return String(value).toLowerCase().includes(currentSearch);
}

function highlight(text) {
  const safeText = escapeHtml(text);
  if (!currentSearch) return safeText;
  const escapedSearch = escapeRegExp(currentSearch);
  return safeText.replace(new RegExp(`(${escapedSearch})`, "gi"), "<mark>$1</mark>");
}

function collectContainerPaths(value, path = "root", paths = new Set()) {
  if (isObject(value) || Array.isArray(value)) {
    paths.add(path);
    Object.entries(value).forEach(([key, child]) => {
      collectContainerPaths(child, `${path}.${escapePath(key)}`, paths);
    });
  }
  return paths;
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.setAttribute("aria-pressed", String(theme === "dark"));
  localStorage.setItem("json-visualizer-theme", theme);
}

function getLineColumn(text, position) {
  const before = text.slice(0, position);
  const lines = before.split(/\r\n|\r|\n/);
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function extractErrorPosition(message) {
  const match = message.match(/position (\d+)/i);
  return match ? Number(match[1]) : null;
}

function stringify(value, spacing) {
  return JSON.stringify(value, null, spacing);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function escapePath(key) {
  return String(key).replaceAll(".", "\\.");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

init();
