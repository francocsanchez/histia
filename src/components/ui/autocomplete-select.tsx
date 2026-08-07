"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type AutocompleteOption = {
  id: string;
  codigo: string;
  nombre: string;
};

function getOptionLabel(option: AutocompleteOption) {
  return `${option.codigo} - ${option.nombre}`;
}

function matchesOption(option: AutocompleteOption, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");

  if (!normalizedQuery) {
    return true;
  }

  return (
    option.codigo.toLocaleLowerCase("es-AR").includes(normalizedQuery) ||
    option.nombre.toLocaleLowerCase("es-AR").includes(normalizedQuery)
  );
}

export function AutocompleteSelect({
  options,
  value,
  onChange,
  placeholder = "Buscar",
  disabled = false,
  className,
  emptyMessage = "No se encontraron codigos",
}: {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(360);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  const isOpen = open && !disabled;
  const selectedOption = options.find((option) => option.id === value) ?? null;
  const filteredOptions = options.filter((option) => matchesOption(option, query));

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let frameId = 0;

    const updateDropdownPosition = () => {
      if (!rootRef.current) {
        return;
      }

      const rect = rootRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom;
      const nextDropdownMaxHeight = Math.max(Math.min(spaceBelow - 12, 360), 160);
      const preferredWidth = Math.max(rect.width, Math.min(704, viewportWidth - 32));
      const nextLeft = Math.min(rect.left, viewportWidth - preferredWidth - 16);
      const nextTop = rect.bottom + 4;

      setDropdownMaxHeight(nextDropdownMaxHeight);
      setDropdownPosition({
        top: nextTop,
        left: Math.max(nextLeft, 16),
        width: preferredWidth,
      });
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateDropdownPosition);
    };

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !rootRef.current) {
      return;
    }

    const rect = rootRef.current.getBoundingClientRect();
    const desiredBottomSpace = 260;
    const missingSpace = desiredBottomSpace - (window.innerHeight - rect.bottom);

    if (missingSpace > 0) {
      window.scrollBy({
        top: missingSpace + 24,
        behavior: "smooth",
      });
    }
  }, [isOpen]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setQuery("");
  };

  const inputValue = isOpen ? query : (selectedOption ? getOptionLabel(selectedOption) : "");
  const activeIndex = Math.min(highlightedIndex, Math.max(filteredOptions.length - 1, 0));

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        className={cn(
          "h-11 w-full border border-input bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground",
          disabled && "cursor-not-allowed bg-muted text-muted-foreground",
        )}
        value={inputValue}
        placeholder={placeholder}
        onFocus={() => {
          if (!disabled) {
            setOpen(true);
            setQuery(selectedOption ? getOptionLabel(selectedOption) : "");
            setHighlightedIndex(0);
          }
        }}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            setQuery(selectedOption ? getOptionLabel(selectedOption) : "");
            setHighlightedIndex(0);
          }
        }}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setOpen(true);
          setHighlightedIndex(0);

          if (nextQuery === "") {
            onChange("");
          }
        }}
        onKeyDown={(event) => {
          if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setOpen(true);
            setQuery(selectedOption ? getOptionLabel(selectedOption) : "");
            setHighlightedIndex(0);
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((currentIndex) =>
              Math.min(currentIndex + 1, Math.max(filteredOptions.length - 1, 0)),
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((currentIndex) => Math.max(currentIndex - 1, 0));
            return;
          }

          if (event.key === "Enter") {
            if (!isOpen) {
              return;
            }

            event.preventDefault();
            const highlightedOption = filteredOptions[activeIndex];

            if (highlightedOption) {
              handleSelect(highlightedOption.id);
            }
            return;
          }

          if (event.key === "Escape") {
            if (isOpen) {
              event.preventDefault();
              setOpen(false);
              setQuery("");
            }
          }
        }}
      />

      {isOpen
        ? createPortal(
            <div
              ref={dropdownRef}
              id={listId}
              role="listbox"
              className="fixed z-[100] overflow-y-auto rounded-md border border-border bg-white shadow-lg"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
                maxHeight: `${dropdownMaxHeight}px`,
              }}
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => {
                  const isHighlighted = index === activeIndex;
                  const isSelected = option.id === value;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full items-start justify-between gap-2 px-2.5 py-1.5 text-left text-xs leading-4",
                        isHighlighted ? "bg-muted" : "bg-white",
                        isSelected ? "font-medium" : "",
                      )}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleSelect(option.id);
                      }}
                      onMouseEnter={() => {
                        setHighlightedIndex(index);
                      }}
                    >
                      <span className="min-w-0 break-words">{getOptionLabel(option)}</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-2.5 py-1.5 text-xs text-muted-foreground">{emptyMessage}</div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
