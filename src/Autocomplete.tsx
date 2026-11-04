import { useId, useState } from 'react';
import { inp } from './ui';
export interface Suggestion { id: string; label: string; detail?: string }
export default function Autocomplete({ label, value, onChange, options, onSelect, placeholder, required = false }: {
  label: string; value: string; onChange: (value: string) => void; options: Suggestion[];
  onSelect: (id: string) => void; placeholder?: string; required?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = value.trim() ? options.filter(option => `${option.label} ${option.detail || ''}`.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 6) : [];
  const visible = open && matches.length > 0;
  const choose = (index: number) => { onSelect(matches[index].id); setOpen(false); setActive(-1); };
  return <div className="autocomplete" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id} className="field-label">{label}</label>
    <input id={id} className={inp} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={visible} aria-controls={`${id}-options`} aria-activedescendant={visible && active >= 0 ? `${id}-${active}` : undefined}
      placeholder={placeholder} required={required} value={value} onFocus={() => setOpen(true)} onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        if (event.key === 'ArrowDown' && matches.length) { event.preventDefault(); setOpen(true); setActive(index => (index + 1) % matches.length); }
        if (event.key === 'ArrowUp' && matches.length) { event.preventDefault(); setOpen(true); setActive(index => (index <= 0 ? matches.length - 1 : index - 1)); }
        if (event.key === 'Enter') { event.preventDefault(); if (visible && active >= 0) choose(active); }
      }} />
    {visible && <ul id={`${id}-options`} role="listbox" aria-label={`${label} suggestions`} className="suggestion-list">{matches.map((option, index) => <li key={option.id} id={`${id}-${index}`} role="option" aria-selected={index === active} onPointerDown={event => event.preventDefault()} onClick={() => choose(index)} onPointerMove={() => setActive(index)} className={active === index ? 'suggestion-active' : ''}><strong>{option.label}</strong>{option.detail && <span>{option.detail}</span>}</li>)}</ul>}
  </div>;
}
