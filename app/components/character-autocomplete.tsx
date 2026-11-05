"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function CharacterAutocomplete({
  options,
  placeholder,
  name = "character",
}: {
  options: string[];
  placeholder: string;
  name?: string;
}) {
  const listId = useId();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeOptionRef = useRef<HTMLLIElement>(null);

  const matches = options.filter((name) =>
    name.toLowerCase().includes(value.trim().toLowerCase()),
  );

  const expanded = open && matches.length > 0;
  useEffect(() => {
    if (expanded && activeIndex >= 0) {
      activeOptionRef.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activeIndex, expanded]);

  function select(name: string) {
    setValue(name);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="character-autocomplete">
      <input
        id="character"
        name={name}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={
          expanded && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        placeholder={placeholder}
        maxLength={100}
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActiveIndex(-1);
        }}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setActiveIndex(-1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) =>
              index <= 0 ? matches.length - 1 : index - 1,
            );
          } else if (event.key === "Enter" && expanded && activeIndex >= 0) {
            event.preventDefault();
            select(matches[activeIndex]);
          }
        }}
      />

      <ul
        id={listId}
        role="listbox"
        aria-label="Character suggestions"
        className="character-suggestions"
        hidden={!expanded}
      >
        {matches.map((name, index) => (
          <li
            ref={index === activeIndex ? activeOptionRef : null}
            id={`${listId}-${index}`}
            key={name}
            role="option"
            aria-selected={index === activeIndex}
            onPointerDown={(event) => {
              event.preventDefault();
              select(name);
            }}
          >
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
