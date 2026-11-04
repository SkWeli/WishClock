import { esc } from './format.js';

/** Render one field from a module's schema. */
export function fieldHtml(field, value, prefix, values = {}) {
  const id = `${prefix}-${field.key}`;
  field = { ...field, label: typeof field.label === 'function' ? field.label(values) : field.label };
  const help = field.help ? `<small class="help">${esc(field.help)}</small>` : '';
  if (field.type === 'toggle') {
    return `<div class="field field-toggle">
      <label class="toggle" for="${id}">
        <input type="checkbox" id="${id}" data-key="${field.key}" ${value ? 'checked' : ''}>
        <span class="track" aria-hidden="true"></span>
        <span>${esc(field.label)}</span>
      </label>${help}</div>`;
  }
  if (field.type === 'select') {
    const opts = field.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
    return `<div class="field"><label for="${id}">${esc(field.label)}</label>
      <select id="${id}" data-key="${field.key}">${opts}</select>${help}</div>`;
  }
  if (field.type === 'month') {
    return `<div class="field"><label for="${id}">${esc(field.label)}</label>
      <input type="month" class="month-input" id="${id}" data-key="${field.key}" value="${esc(value)}">${help}</div>`;
  }
  const money = field.type === 'money';
  return `<div class="field"><label for="${id}">${esc(field.label)}</label>
    <div class="input-wrap${money ? ' has-prefix' : ''}">
      ${money ? '<span class="prefix">Rs</span>' : ''}
      <input type="number" inputmode="decimal" id="${id}" data-key="${field.key}"
        value="${esc(value)}" ${field.min != null ? `min="${field.min}"` : ''} ${field.max != null ? `max="${field.max}"` : ''} step="${field.step ?? 1}">
      ${field.suffix ? `<span class="suffix">${esc(field.suffix)}</span>` : ''}
    </div>${help}</div>`;
}

/** Group a schema's fields under fieldset legends, hiding fields whose showIf is false. */
export function fieldsHtml(fields, values, prefix) {
  const groups = new Map();
  for (const f of fields) {
    if (f.showIf && !f.showIf(values)) continue;
    const g = f.group ?? 'Details';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(fieldHtml(f, values[f.key], prefix, values));
  }
  return [...groups].map(([legend, html]) => `<fieldset>${legend ? `<legend>${esc(legend)}</legend>` : ''}<div class="fields">${html.join('')}</div></fieldset>`).join('');
}

/** Read a value back from an input, keeping the schema's type. */
export function readField(field, el) {
  if (field.type === 'toggle') return el.checked;
  if (field.type === 'month') return el.value;
  if (field.type === 'select') {
    const isNum = typeof field.options[0].value === 'number';
    return isNum ? Number(el.value) : el.value;
  }
  const n = parseFloat(el.value);
  return Number.isFinite(n) ? n : 0;
}

export function clampField(field, v) {
  if (typeof v !== 'number') return v;
  if (field.min != null && v < field.min) return field.min;
  if (field.max != null && v > field.max) return field.max;
  return v;
}

/** Which fields are visible — used to decide whether a form needs re-rendering. */
export const visibility = (fields, values) => fields.map((f) => (f.showIf ? (f.showIf(values) ? 1 : 0) : 1)).join('');
