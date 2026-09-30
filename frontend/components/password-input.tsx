"use client";

import { useState, type ChangeEvent } from "react";

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

type PasswordInputProps = {
  id: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  minLength?: number;
  required?: boolean;
};

export function PasswordInput({ id, name, value, onChange, minLength, required }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative mt-1">
      <input
        id={id}
        name={name}
        type={isVisible ? "text" : "password"}
        required={required}
        minLength={minLength}
        value={value}
        onChange={onChange}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 pr-10 text-sm"
      />
      <button
        type="button"
        onClick={() => setIsVisible((current) => !current)}
        aria-label={isVisible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 hover:text-zinc-600"
      >
        {isVisible ? <EyeIcon /> : <EyeClosedIcon />}
      </button>
    </div>
  );
}
