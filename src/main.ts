import './style.css';
import * as monaco from 'monaco-editor';
import { GuessLang } from '@ray-d-song/guesslang-js';
import { readUrlHash, updateUrlHash } from './compression';
import type { SnippetData } from './compression';

// Define custom VS Code Dark+ theme with enhanced colors
monaco.editor.defineTheme('vscode-dark-plus', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // JavaScript/TypeScript specific tokens (Monaco uses language suffix)
    { token: 'identifier.js', foreground: '9CDCFE' },
    { token: 'identifier.ts', foreground: '9CDCFE' },
    { token: 'type.identifier.js', foreground: '4EC9B0' },
    { token: 'type.identifier.ts', foreground: '4EC9B0' },

    // Keywords - purple/pink like VS Code
    { token: 'keyword.js', foreground: 'C586C0' },
    { token: 'keyword.ts', foreground: 'C586C0' },
    { token: 'keyword', foreground: 'C586C0' },

    // Strings - orange/salmon
    { token: 'string.js', foreground: 'CE9178' },
    { token: 'string.ts', foreground: 'CE9178' },
    { token: 'string', foreground: 'CE9178' },

    // Numbers - green
    { token: 'number.js', foreground: 'B5CEA8' },
    { token: 'number.ts', foreground: 'B5CEA8' },
    { token: 'number', foreground: 'B5CEA8' },

    // Comments - green
    { token: 'comment.js', foreground: '6A9955' },
    { token: 'comment.ts', foreground: '6A9955' },
    { token: 'comment', foreground: '6A9955' },

    // Delimiters/brackets
    { token: 'delimiter.js', foreground: 'D4D4D4' },
    { token: 'delimiter.ts', foreground: 'D4D4D4' },

    // Python specific
    { token: 'keyword.python', foreground: 'C586C0' },
    { token: 'identifier.python', foreground: '9CDCFE' },
    { token: 'string.python', foreground: 'CE9178' },
    { token: 'number.python', foreground: 'B5CEA8' },
    { token: 'comment.python', foreground: '6A9955' },

    // Generic fallbacks
    { token: 'type', foreground: '4EC9B0' },
    { token: 'class', foreground: '4EC9B0' },
  ],
  colors: {
    'editor.background': '#1E1E1E',
    'editor.foreground': '#D4D4D4',
    'editorLineNumber.foreground': '#858585',
    'editorLineNumber.activeForeground': '#C6C6C6',
    'editor.selectionBackground': '#264F78',
    'editor.lineHighlightBackground': '#2A2D2E',
    'editorCursor.foreground': '#AEAFAD',
  }
});

const VSCODE_TO_MONACO_MAP: Record<string, string> = {
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'md': 'markdown',
  'cs': 'csharp',
  'cpp': 'cpp',
  'rb': 'ruby',
  'rs': 'rust',
  'jl': 'julia',
  'hs': 'haskell',
  'kt': 'kotlin',
  'ex': 'elixir',
  'erl': 'erlang',
  'sh': 'shell',
  'ml': 'objective-c', // Often used for OCaml/OC-ML
  'mm': 'objective-c',
  'ps1': 'powershell',
  'f90': 'fortran',
  'cbl': 'cobol',
  'pm': 'perl',
  'tex': 'latex',
  // Direct matches (IDs that are the same in both)
  'scala': 'scala',
  'pas': 'pascal',
  'ini': 'ini',
  'sql': 'sql',
  'asm': 'asm',
  'matlab': 'matlab',
  'swift': 'swift',
  'cmake': 'cmake',
  'vba': 'vb',
  'html': 'html',
  'clj': 'clojure',
  'dart': 'dart',
  'xml': 'xml',
  'csv': 'csv',
  'lua': 'lua',
  'prolog': 'prolog',
  'coffee': 'coffeescript',
  'groovy': 'groovy',
  'json': 'json',
  'java': 'java',
  'lisp': 'lisp',
  'c': 'c',
  'makefile': 'makefile',
  'v': 'verilog',
  'r': 'r',
  'php': 'php',
  'yaml': 'yaml',
  'css': 'css',
  'bat': 'bat',
  'toml': 'toml',
  'go': 'go',
  'dockerfile': 'dockerfile'
};

// Available languages for manual selection (sorted)
const availableLanguages = Array.from(new Set(Object.values(VSCODE_TO_MONACO_MAP))).sort();

// Disable Monaco workers - run in main thread (fine for small snippets)
self.MonacoEnvironment = {
  getWorker: () => {
    throw new Error('Workers disabled');
  }
};

let editor: monaco.editor.IStandaloneCodeEditor;
let isReadOnly = false;
let currentLanguage = 'plaintext';
let lastTapTime = 0;

const guessLang = new GuessLang();

/**
 * Safely converts VS Code ML IDs to Monaco IDs
 */
function getMonacoLang(vsCodeId: string): string {
  const mapped = VSCODE_TO_MONACO_MAP[vsCodeId];

  // Check if the language is actually loaded in your Monaco instance
  const availableLangs = monaco.languages.getLanguages().map(l => l.id);

  if (mapped && availableLangs.includes(mapped)) {
    return mapped;
  }

  if (!availableLangs.includes(vsCodeId)) {
    console.log(`Language ${vsCodeId} not found in Monaco`);
  }

  // Return the original ID if it exists in Monaco, otherwise plaintext
  return availableLangs.includes(vsCodeId) ? vsCodeId : 'plaintext';
}

/**
 * Detect language using highlight.js auto-detection with improved heuristics.
 */
async function detectLanguageFromContent(code: string): Promise<string> {
  const result = await guessLang.runModel(code);
  console.log(code, result);
  if (result && result.length > 0) {
    return getMonacoLang(result[0].languageId);
  }
  return 'plaintext';
}

/**
 * Updates the language indicator/selector in the UI.
 */
function updateLanguageIndicator(): void {
  let selector = document.getElementById('language-selector') as HTMLSelectElement | null;

  // Create dropdown if it doesn't exist
  if (!selector) {
    const container = document.getElementById('language-indicator');
    if (!container) return;

    // Replace the span with a select
    selector = document.createElement('select');
    selector.id = 'language-selector';
    selector.className = 'language-selector';
    selector.title = 'Select language (or auto-detect)';

    // Add plaintext as first option (always available)
    const plaintextOption = document.createElement('option');
    plaintextOption.value = 'plaintext';
    plaintextOption.textContent = 'plaintext';
    selector.appendChild(plaintextOption);

    // Add other options
    availableLanguages.forEach(lang => {
      if (lang !== 'plaintext') { // Avoid duplicate
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = lang;
        selector!.appendChild(option);
      }
    });

    // Handle manual selection
    selector.addEventListener('change', () => {
      const newLang = selector!.value;
      if (newLang !== currentLanguage) {
        currentLanguage = newLang;
        if (editor) {
          monaco.editor.setModelLanguage(editor.getModel()!, newLang);
          // Always update URL with new language (even in read-only mode)
          updateUrlHash(editor.getValue(), currentLanguage);
        }
      }
    });

    container.replaceWith(selector);
  }

  // Fallback to plaintext if currentLanguage is empty
  const langToSet = currentLanguage || 'plaintext';

  // Update selected value
  if (selector && selector.value !== langToSet) {
    selector.value = langToSet;
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
 * Debounce helper that supports async functions.
 */
function debounce(fn: () => void | Promise<void>, delay: number): () => void {
  let timer: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

/**
 * Updates the URL status indicator in the header.
 */
function updateUrlStatus(status: { length: number; isWarning: boolean; isError: boolean }): void {
  const container = document.getElementById('url-status');
  const fill = container?.querySelector('.url-status-fill') as HTMLElement | null;
  const text = container?.querySelector('.url-status-text') as HTMLElement | null;

  if (!container || !fill || !text) return;

  const maxLength = 8000;
  const percentage = Math.min((status.length / maxLength) * 100, 100);

  // Update progress bar
  fill.style.width = `${percentage}%`;

  // Update text
  const displayLength = status.length >= 1000
    ? `${(status.length / 1000).toFixed(1)}k`
    : `${status.length}`;
  text.textContent = `${displayLength} / 8k`;

  // Update status class
  container.classList.remove('status-ok', 'status-warning', 'status-error');
  if (status.isError) {
    container.classList.add('status-error');
    container.title = `URL too long (${status.length} chars) - won't be saved`;
  } else if (status.isWarning) {
    container.classList.add('status-warning');
    container.title = `URL getting long (${status.length} chars) - may not work in some browsers`;
  } else {
    container.classList.add('status-ok');
    container.title = `URL length: ${status.length} chars`;
  }
}

/**
 * Shows/hides URL length warning toast.
 */
function showUrlWarning(status: { length: number; isWarning: boolean; isError: boolean }): void {
  // Always update the status indicator
  updateUrlStatus(status);

  let warning = document.getElementById('url-warning');

  if (!status.isWarning && !status.isError) {
    if (warning) warning.remove();
    return;
  }

  if (!warning) {
    warning = document.createElement('div');
    warning.id = 'url-warning';
    document.body.appendChild(warning);
  }

  // Update class and content
  warning.className = status.isError ? 'error' : 'warning';

  if (status.isError) {
    warning.innerHTML = `
      <span style="font-size: 18px;">⛔</span>
      <span><strong>URL too long!</strong> (${status.length.toLocaleString()} chars) — Changes won't be saved.</span>
    `;
  } else {
    warning.innerHTML = `
      <span style="font-size: 18px;">⚠️</span>
      <span><strong>Long URL</strong> (${status.length.toLocaleString()} chars) — May not work in all browsers.</span>
    `;
  }
}

/**
 * Handles code changes - updates URL and language.
 */
const handleCodeChange = debounce(async () => {
  if (!isReadOnly && editor) {
    const code = editor.getValue();
    const detected = await detectLanguageFromContent(code);

    if (detected !== currentLanguage) {
      currentLanguage = detected;
      monaco.editor.setModelLanguage(editor.getModel()!, detected);
      updateLanguageIndicator();
    }

    const urlStatus = updateUrlHash(code, currentLanguage);
    showUrlWarning(urlStatus);
  }
}, 1500);

/**
 * Initialize the application.
 */
async function init(): Promise<void> {
  const container = document.getElementById('editor-container');
  if (!container) {
    console.error('Editor container not found');
    return;
  }

  // Read initial data from URL
  const urlData: SnippetData | null = readUrlHash();
  const initialCode = urlData?.code || '';
  isReadOnly = !!urlData?.code;
  currentLanguage = urlData?.lang || (initialCode ? await detectLanguageFromContent(initialCode) : 'plaintext');

  // Create Monaco editor with minimal features
  editor = monaco.editor.create(container, {
    value: initialCode,
    language: currentLanguage,
    theme: 'vscode-dark-plus',
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
