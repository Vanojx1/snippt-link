import './style.css';
import * as monaco from 'monaco-editor';
import { readUrlHash, updateUrlHash } from './compression';
import type { SnippetData } from './compression';

// Configure Monaco workers
self.MonacoEnvironment = {
  getWorker: function (_moduleId: string, label: string) {
    const getWorkerModule = (moduleUrl: string) => {
      return new Worker(new URL(moduleUrl, import.meta.url), { type: 'module' });
    };

    switch (label) {
      case 'json':
        return getWorkerModule('monaco-editor/esm/vs/language/json/json.worker?worker');
      case 'css':
      case 'scss':
      case 'less':
        return getWorkerModule('monaco-editor/esm/vs/language/css/css.worker?worker');
      case 'html':
      case 'handlebars':
      case 'razor':
        return getWorkerModule('monaco-editor/esm/vs/language/html/html.worker?worker');
      case 'typescript':
      case 'javascript':
        return getWorkerModule('monaco-editor/esm/vs/language/typescript/ts.worker?worker');
      default:
        return getWorkerModule('monaco-editor/esm/vs/editor/editor.worker?worker');
    }
  }
};

let editor: monaco.editor.IStandaloneCodeEditor;
let isReadOnly = false;
let currentLanguage = 'plaintext';
let lastTapTime = 0;

/**
 * Updates the language indicator in the UI.
 */
function updateLanguageIndicator(): void {
  const indicator = document.getElementById('language-indicator');
  if (indicator) {
    indicator.textContent = currentLanguage || 'plain text';
  }
}

/**
 * Updates the mode indicator in the UI.
 */
function updateModeIndicator(): void {
  const indicator = document.getElementById('mode-indicator');
  const container = document.getElementById('editor-container');
  if (indicator) {
    indicator.textContent = isReadOnly ? '👁 Read-only' : '✏️ Editing';
    indicator.className = `indicator ${isReadOnly ? 'read-only' : 'editing'}`;
  }
  if (container) {
    container.classList.toggle('read-only', isReadOnly);
  }
}

/**
 * Sets the editor read-only state.
 */
function setReadOnly(readonly: boolean): void {
  isReadOnly = readonly;
  editor.updateOptions({ readOnly: readonly });
  updateModeIndicator();
}

/**
 * Handles double-tap to toggle edit mode.
 */
function handleTap(): void {
  const now = Date.now();
  if (now - lastTapTime < 300 && isReadOnly) {
    setReadOnly(false);
    editor.focus();
  }
  lastTapTime = now;
}

/**
 * Debounce helper.
 */
function debounce(fn: () => void, delay: number): () => void {
  let timer: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

/**
 * Get detected language from Monaco's language detection.
 */
function detectLanguageFromContent(code: string): string {
  // Monaco doesn't have built-in detection, but we can infer from model
  // For now, use simple patterns for common languages
  const trimmed = code.trim();
  const firstLine = trimmed.split('\n')[0] || '';

  // HTML
  if (/^<!DOCTYPE|^<html|^<head|^<body/i.test(trimmed)) return 'html';

  // JSON
  if (/^[\[\{]/.test(trimmed) && /[\]\}]$/.test(trimmed)) {
    try { JSON.parse(trimmed); return 'json'; } catch { }
  }

  // YAML
  if (/^[a-zA-Z_][a-zA-Z0-9_-]*:\s*/.test(firstLine) && !trimmed.includes('{') && !trimmed.includes(';')) {
    return 'yaml';
  }

  // Python
  if (/^(import |from |def |class |if __name__|async def )/.test(trimmed)) return 'python';

  // TypeScript
  if (/:\s*(string|number|boolean|void|Promise<|Array<)/.test(trimmed) || /^(interface |type |enum )/.test(trimmed)) {
    return 'typescript';
  }

  // JavaScript
  if (/^(import |export |const |let |var |function |=>|class )/.test(trimmed) ||
    /console\.|require\(|module\.exports/.test(trimmed)) {
    return 'javascript';
  }

  // CSS
  if (/^(\.|#|@media|body|html)\s*\{/.test(trimmed)) return 'css';

  // Shell
  if (/^#!/.test(trimmed) || /^\$\s/.test(firstLine)) return 'shell';

  // SQL
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/i.test(trimmed)) return 'sql';

  // Markdown
  if (/^#{1,6}\s/.test(trimmed) || /^\*\*/.test(trimmed)) return 'markdown';

  // C/C++
  if (/^#include\s*[<"]/.test(trimmed)) return trimmed.includes('iostream') ? 'cpp' : 'c';

  // Go
  if (/^(package |func |import \()/.test(trimmed)) return 'go';

  // Rust
  if (/^(fn |pub fn |struct |impl )/.test(trimmed)) return 'rust';

  // Java
  if (/^(public |private )?(class |interface )/.test(trimmed)) return 'java';

  return 'plaintext';
}

/**
 * Handles code changes - updates URL and language.
 */
const handleCodeChange = debounce(() => {
  if (!isReadOnly && editor) {
    const code = editor.getValue();
    const detected = detectLanguageFromContent(code);

    if (detected !== currentLanguage) {
      currentLanguage = detected;
      monaco.editor.setModelLanguage(editor.getModel()!, detected);
      updateLanguageIndicator();
    }

    updateUrlHash(code, currentLanguage);
  }
}, 1500);

/**
 * Initialize the application.
 */
function init(): void {
  const container = document.getElementById('editor-container');
  if (!container) {
    console.error('Editor container not found');
    return;
  }

  // Read initial data from URL
  const urlData: SnippetData | null = readUrlHash();
  const initialCode = urlData?.code || '';
  isReadOnly = !!urlData?.code;
  currentLanguage = urlData?.lang || detectLanguageFromContent(initialCode);

  // Create Monaco editor with minimal features
  editor = monaco.editor.create(container, {
    value: initialCode,
    language: currentLanguage,
    theme: 'vs-dark',
    readOnly: isReadOnly,

    // Minimal features (no IntelliSense)
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", monospace',
    fontLigatures: true,
    lineNumbers: 'on',
    renderLineHighlight: 'line',

    // Basic write assist
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    autoIndent: 'full',
    formatOnPaste: false,
    formatOnType: false,

    // Disable complex features
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    acceptSuggestionOnEnter: 'off',
    parameterHints: { enabled: false },
    hover: { enabled: false },
    codeLens: false,
    folding: false,
    links: false,
    contextmenu: false,

    // Accessibility
    accessibilitySupport: 'off',

    // Padding
    padding: { top: 16, bottom: 16 },

    // Scrollbar styling
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
  });

  // Handle content changes
  editor.onDidChangeModelContent(() => {
    handleCodeChange();
  });

  // Handle resize
  window.addEventListener('resize', () => {
    editor.layout();
  });

  // Set up double-tap handling
  container.addEventListener('touchend', handleTap);
  container.addEventListener('click', handleTap);

  // Update UI
  updateModeIndicator();
  updateLanguageIndicator();

  // Hide loading screen
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    setTimeout(() => loadingScreen.remove(), 300);
  }

  // Focus editor if in edit mode
  if (!isReadOnly) {
    editor.focus();
  }
}

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
