import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ImageQualityOption } from "../countrySetupStore";
import styles from "./ImageQualitySetting.module.css";

export function ImageQualityDropdown({ id, value, options, disabled, locked = false, describedBy, onChange }: {
  id: string;
  value: string;
  options: readonly ImageQualityOption[];
  disabled: boolean;
  locked?: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [side, setSide] = useState("bottom");
  const [menuLeft, setMenuLeft] = useState(0);
  const listId = `${id}-options`;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const isDisabled = disabled || options.length === 0;

  useEffect(() => {
    if (!isOpen) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [isOpen]);

  useEffect(() => {
    const menu = menuRef.current;
    const option = menu?.querySelector<HTMLElement>('[data-active="true"]');
    if (!isOpen || !menu || !option) return;
    if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
    }
  }, [isOpen, activeIndex]);

  function open(index = selectedIndex) {
    if (isDisabled) return;
    const bounds = rootRef.current?.parentElement?.getBoundingClientRect();
    setSide(bounds && bounds.bottom + 220 > innerHeight && bounds.top > innerHeight - bounds.bottom ? "top" : "bottom");
    const menuWidth = Math.min(232, innerWidth - 32);
    setMenuLeft(bounds ? Math.max(16, Math.min(bounds.left, innerWidth - menuWidth - 16)) - bounds.left : 0);
    setActiveIndex(index);
    setIsOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || isDisabled) return;
    setIsOpen(false);
    onChange(option.value);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (isDisabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) open();
      else setActiveIndex((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      open(event.key === "Home" ? 0 : options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen) choose(activeIndex);
      else open();
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
    } else if (event.key === "Tab") {
      setIsOpen(false);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const index = options.findIndex((option) => option.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (index >= 0) {
        event.preventDefault();
        open(index);
      }
    }
  }

  return (
    <div ref={rootRef} className={styles.control}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label="Illustration detail"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={isOpen ? `${listId}-${activeIndex}` : undefined}
        aria-describedby={describedBy}
        disabled={isDisabled}
        value={value}
        className={styles.select}
        onKeyDown={onKeyDown}
        onBlur={() => setIsOpen(false)}
        onClick={() => isOpen ? setIsOpen(false) : open()}
      >
        <span>{options.find((option) => option.value === value)?.label ?? value}</span>
        {!locked ? <svg className={styles.chevron} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg> : null}
      </button>
      {isOpen ? <div ref={menuRef} className={styles.menu} data-side={side} style={{ left: menuLeft }}>
        <div className={styles["menu-heading"]} aria-hidden="true">Illustration detail</div>
        <ul id={listId} className={styles.options} role="listbox" aria-label="Illustration detail">
          {options.map((option, index) => <li
            key={option.value}
            id={`${listId}-${index}`}
            role="option"
            aria-label={option.label}
            aria-describedby={`${listId}-${index}-description`}
            aria-selected={option.value === value}
            data-active={index === activeIndex}
            className={styles.option}
            onPointerMove={() => setActiveIndex(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(index)}
          >
            <span className={styles["option-copy"]}>
              <span className={styles["option-label"]}>{option.label}</span>
              <small id={`${listId}-${index}-description`}>{option.description}</small>
            </span>
            <span className={styles["option-check"]} aria-hidden="true">{option.value === value ? "✓" : ""}</span>
          </li>)}
        </ul>
      </div> : null}
    </div>
  );
}
