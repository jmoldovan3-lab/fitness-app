interface Props<T> {
  label: string;
  options: [T, string][];
  value: T | T[];
  onChange: (v: T) => void;
  multi?: boolean;
  name: string;
}

export function Chips<T extends string | number>({ label, options, value, onChange, multi, name }: Props<T>) {
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <fieldset class="field">
      <legend>{label}</legend>
      <div class="chips" role={multi ? 'group' : 'radiogroup'} data-name={name}>
        {options.map(([v, text]) => (
          <button
            type="button"
            key={String(v)}
            class={`chip${selected(v) ? ' on' : ''}`}
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={selected(v)}
            data-value={String(v)}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
