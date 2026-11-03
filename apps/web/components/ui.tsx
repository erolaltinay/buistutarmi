'use client';
// Form parçaları. Sayı alanı yazarken metni korur (virgül de kabul eder), değeri sayı ya da null olarak verir.
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { MaybeNumber, Status } from '@bitm/engine';

export const parseNumber = (text: string): number | null => {
  const x = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(x) ? x : null;
};

const show = (v: MaybeNumber) => (v === null || v === undefined ? '' : String(v));

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: MaybeNumber;
  onValue: (v: number | null) => void;
};

export function NumberInput({ value, onValue, ...rest }: NumberInputProps) {
  const [text, setText] = useState(show(value));
  const focused = useRef(false);
  // Değer dışarıdan değişirse (ör. "Menüye uygula") ve kullanıcı yazmıyorsa metni güncelle.
  useEffect(() => {
    if (!focused.current) setText(show(value));
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className="num"
      {...rest}
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(show(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        onValue(parseNumber(e.target.value));
      }}
    />
  );
}

export function NumberField({
  label,
  value,
  onValue,
  id,
}: {
  label: string;
  value: MaybeNumber;
  onValue: (v: number | null) => void;
  id: string;
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <NumberInput id={id} value={value} onValue={onValue} />
    </label>
  );
}

export function TextField({
  label,
  value,
  onValue,
  id,
  maxLength,
}: {
  label: string;
  value: string;
  onValue: (v: string) => void;
  id: string;
  maxLength?: number;
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onValue(e.target.value)}
      />
    </label>
  );
}

export function Panel({
  title,
  sub,
  hint,
  children,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="panel">
      {title !== undefined && (
        <h2>
          <span>{title}</span>
          {sub !== undefined && <small>{sub}</small>}
        </h2>
      )}
      {hint !== undefined && <p className="hint">{hint}</p>}
      {children}
    </div>
  );
}

export function Pill({ tone, children }: { tone?: Status | null; children: ReactNode }) {
  return <span className={`pill${tone ? ` ${tone}` : ''}`}>{children}</span>;
}

export function Seg<T extends string | number | boolean>({
  options,
  value,
  onValue,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onValue: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onValue(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DelButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations('wb');
  return (
    <button className="del" type="button" aria-label={t('del')} onClick={onClick}>
      ×
    </button>
  );
}
