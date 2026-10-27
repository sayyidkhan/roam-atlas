// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageQualityDropdown } from "../../apps/web/src/features/countrySetup/components/ImageQualityDropdown";
import { ImageQualitySetting } from "../../apps/web/src/features/countrySetup/components/ImageQualitySetting";

afterEach(cleanup);
const options = [
  { value: "low", label: "Low", description: "Fastest" },
  { value: "medium", label: "Medium", description: "Balanced" },
  { value: "high", label: "High", description: "Best detail" }
];

describe("ImageQualityDropdown", () => {
  it("exposes the selected option and commits a pointer choice", () => {
    const onChange = vi.fn();
    render(<ImageQualityDropdown id="quality" value="high" options={options} disabled={false} onChange={onChange} />);
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("option", { name: "High" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Balanced")).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "Medium" }));
    expect(onChange).toHaveBeenCalledWith("medium");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("supports arrows, Home/End, first-letter navigation and Enter without premature changes", () => {
    const onChange = vi.fn();
    render(<ImageQualityDropdown id="quality" value="high" options={options} disabled={false} onChange={onChange} />);
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Home" });
    expect(trigger.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: "Low" }).id);
    fireEvent.keyDown(trigger, { key: "End" });
    expect(trigger.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: "High" }).id);
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(trigger.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: "Medium" }).id);
    fireEvent.keyDown(trigger, { key: "l" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("low");
  });

  it("dismisses with Escape, Tab and an outside pointer without committing", () => {
    const onChange = vi.fn();
    render(<ImageQualityDropdown id="quality" value="high" options={options} disabled={false} onChange={onChange} />);
    const trigger = screen.getByRole("combobox");
    for (const key of ["Escape", "Tab"]) {
      fireEvent.click(trigger);
      fireEvent.keyDown(trigger, { key });
      expect(screen.queryByRole("listbox")).toBeNull();
    }
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes an open menu and disables changes when artwork becomes locked", () => {
    const onChange = vi.fn();
    const props = { selectedValue: "high", options, onChange };
    const { rerender } = render(<ImageQualitySetting {...props} lockState={{ status: "ready", lock: { countrySlug: "singapore", imageQuality: null, locked: false } }} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeTruthy();
    rerender(<ImageQualitySetting {...props} lockState={{ status: "ready", lock: { countrySlug: "singapore", imageQuality: "medium", locked: true } }} />);
    expect(screen.getByRole("combobox")).toHaveProperty("disabled", true);
    expect(screen.getByRole("combobox").textContent).toBe("Medium");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
