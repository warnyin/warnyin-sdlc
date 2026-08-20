// A searchable multi-select checkbox prompt in ~120 lines of node:readline.
// The state machine is a pure reducer so the whole interaction is testable
// without a TTY; only `multiSelect()` touches the terminal.
// CLI-only: this must NOT move into lib/, which is copied verbatim into every
// installed project as sdlc/.hooks/lib/.

import readline from 'node:readline';
import { ESC, SYMBOLS } from './ui.mjs';

const MIN_ERROR = 'Select at least one tool — space toggles, enter confirms';

const freeze = (state) => Object.freeze(state);

export function initState(choices) {
  return freeze({
    choices,
    selected: choices.filter((c) => c.preSelected).map((c) => c.value),
    cursor: 0,
    filter: '',
    error: null,
    status: 'idle',
  });
}

export function visibleChoices(state) {
  const query = state.filter.trim().toLowerCase();
  if (!query) return state.choices;
  return state.choices.filter(
    (c) => c.name.toLowerCase().includes(query) || c.value.toLowerCase().includes(query),
  );
}

// Every transition returns a new object — the caller compares by identity to
// decide whether a repaint is needed.
const next = (state, patch) => freeze({ ...state, ...patch, error: null });

function toggle(selected, value) {
  return selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
}

function isPrintable(key) {
  return !key.ctrl && !key.meta && typeof key.sequence === 'string'
    && key.sequence.length === 1 && key.sequence >= ' ' && key.sequence.charCodeAt(0) !== 127;
}

export function reduceKey(state, key = {}) {
  if (state.status !== 'idle') return state;
  const visible = visibleChoices(state);
  const count = visible.length;

  if (key.ctrl && key.name === 'c') return freeze({ ...state, status: 'cancelled' });

  // ctrl+a acts on what is on screen, so it composes with the filter rather
  // than silently selecting hidden rows.
  if (key.ctrl && key.name === 'a') {
    if (!count) return state;
    const values = visible.map((c) => c.value);
    const allOn = values.every((v) => state.selected.includes(v));
    const selected = allOn
      ? state.selected.filter((v) => !values.includes(v))
      : [...state.selected, ...values.filter((v) => !state.selected.includes(v))];
    return next(state, { selected });
  }

  switch (key.name) {
    case 'up':
      return count ? next(state, { cursor: (state.cursor - 1 + count) % count }) : state;
    case 'down':
      return count ? next(state, { cursor: (state.cursor + 1) % count }) : state;
    case 'space':
      return count ? next(state, { selected: toggle(state.selected, visible[state.cursor].value) }) : state;
    case 'return':
      if (!state.selected.length) return freeze({ ...state, error: MIN_ERROR });
      return freeze({ ...state, status: 'done', error: null });
    case 'backspace':
      return state.filter ? next(state, { filter: state.filter.slice(0, -1), cursor: 0 }) : state;
    case 'escape':
      return state.filter ? next(state, { filter: '', cursor: 0 }) : state;
    default:
      break;
  }

  if (isPrintable(key)) return next(state, { filter: state.filter + key.sequence, cursor: 0 });
  return state;
}

export function renderLines(state, style, symbols = SYMBOLS.unicode) {
  const visible = visibleChoices(state);
  const head = state.filter
    ? `${style.cyan('?')} ${style.bold('Select tools to set up')} ${style.dim(`filter: ${state.filter}`)}`
    : `${style.cyan('?')} ${style.bold('Select tools to set up')}`;

  // Notes line up in their own column; a row without one keeps no trailing space.
  const width = visible.reduce((w, c) => Math.max(w, c.name.length), 0);
  const rows = visible.map((choice, i) => {
    const focused = i === state.cursor;
    const box = state.selected.includes(choice.value) ? style.green(symbols.on) : symbols.off;
    const note = choice.note ? `${' '.repeat(width - choice.name.length + 2)}${style.dim(choice.note)}` : '';
    const label = focused ? style.cyan(choice.name) : choice.name;
    return `${focused ? style.cyan(symbols.pointer) : ' '} ${box} ${label}${note}`;
  });
  if (!rows.length) rows.push(`  ${style.dim('no tool matches this filter')}`);

  const lines = [head, ...rows, style.dim('  space toggle · ctrl+a all · type to filter · enter confirm')];
  if (state.error) lines.push(style.yellow(`  ${state.error}`));
  return lines;
}

// Resolves to the selected values, or null when the user cancels.
export function multiSelect({ choices, style, symbols, input = process.stdin, output = process.stdout }) {
  return new Promise((resolve) => {
    let state = initState(choices);
    let height = 0;

    const erase = () => { if (height) output.write(`${ESC}[${height}A${ESC}[0J`); };
    const draw = () => {
      const lines = renderLines(state, style, symbols);
      erase();
      output.write(`${lines.join('\n')}\n`);
      height = lines.length;
    };

    const finish = (result) => {
      input.off('keypress', onKey);
      if (input.isTTY) input.setRawMode(false);
      input.pause();
      erase();
      output.write(`${ESC}[?25h`);
      resolve(result);
    };

    const onKey = (_str, key) => {
      const updated = reduceKey(state, key ?? {});
      if (updated === state) return;
      state = updated;
      if (state.status === 'idle') { draw(); return; }
      finish(state.status === 'done' ? state.selected : null);
    };

    readline.emitKeypressEvents(input);
    if (input.isTTY) input.setRawMode(true);
    input.resume();
    input.on('keypress', onKey);
    output.write(`${ESC}[?25l`);
    draw();
  });
}
