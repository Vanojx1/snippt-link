import './style.css';
import * as monaco from 'monaco-editor';
import hljs from 'highlight.js/lib/core';
// Import common languages for detection
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import cpp from 'highlight.js/lib/languages/cpp';
import c from 'highlight.js/lib/languages/c';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import shell from 'highlight.js/lib/languages/shell';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import powershell from 'highlight.js/lib/languages/powershell';
import objectivec from 'highlight.js/lib/languages/objectivec';
import scala from 'highlight.js/lib/languages/scala';

import { readUrlHash, updateUrlHash } from './compression';
import type { SnippetData } from './compression';

// Register languages with highlight.js
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', c);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('php', php);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml); // HTML uses XML parser
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('objectivec', objectivec);
hljs.registerLanguage('scala', scala);

// Map highlight.js names to Monaco language IDs
const hljsToMonaco: Record<string, string> = {
  'javascript': 'javascript',
  'typescript': 'typescript',
  'python': 'python',
  'java': 'java',
  'csharp': 'csharp',
  'cpp': 'cpp',
  'c': 'c',
  'go': 'go',
  'rust': 'rust',
  'ruby': 'ruby',
  'php': 'php',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'sql': 'sql',
  'bash': 'shell',
  'shell': 'shell',
  'json': 'json',
  'xml': 'xml',
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'yaml': 'yaml',
  'markdown': 'markdown',
  'dockerfile': 'dockerfile',
  'powershell': 'powershell',
  'objectivec': 'objective-c',
  'scala': 'scala',
};

// Available languages for manual selection (sorted)
const availableLanguages = [
  'plaintext', 'javascript', 'typescript', 'python', 'java', 'csharp',
  'cpp', 'c', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql',
  'shell', 'powershell', 'json', 'xml', 'html', 'css', 'scss', 'yaml',
  'markdown', 'dockerfile', 'objective-c', 'scala'
].sort();

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

/**
 * Detect language using highlight.js auto-detection.
 */
function detectLanguageFromContent(code: string): string {
  if (!code.trim()) return 'plaintext';

  try {
    const result = hljs.highlightAuto(code);
    if (result.language && result.relevance > 5) {
      return hljsToMonaco[result.language] || result.language;
    }
  } catch {
    // Fallback to plaintext on error
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

    // Add options
    availableLanguages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang;
      selector!.appendChild(option);
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

  // Update selected value
  if (selector && selector.value !== currentLanguage) {
    selector.value = currentLanguage;
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
 * Shows/hides URL length warning.
 */
function showUrlWarning(status: { length: number; isWarning: boolean; isError: boolean }): void {
  let warning = document.getElementById('url-warning');

  if (!status.isWarning && !status.isError) {
    if (warning) warning.remove();
    return;
  }

  if (!warning) {
    warning = document.createElement('div');
    warning.id = 'url-warning';
    warning.style.cssText = `
      position: fixed;
      bottom: 50px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-family: -apple-system, sans-serif;
      z-index: 1000;
      animation: fadeIn 0.3s ease;
    `;
    document.body.appendChild(warning);
  }

  if (status.isError) {
    warning.style.background = '#f85149';
    warning.style.color = '#fff';
    warning.textContent = `⚠️ URL too long (${status.length} chars) - won't be saved. Max ~8000 chars.`;
  } else {
    warning.style.background = '#d29922';
    warning.style.color = '#fff';
    warning.textContent = `⚠️ URL getting long (${status.length} chars) - may not work in some browsers`;
  }
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

    const urlStatus = updateUrlHash(code, currentLanguage);
    showUrlWarning(urlStatus);
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
