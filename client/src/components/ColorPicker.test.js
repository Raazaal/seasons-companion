import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import ColorPicker from "./ColorPicker.svelte";

describe("ColorPicker", () => {
  it("disables colors already taken", () => {
    render(ColorPicker, { takenColors: ["red"], selected: null, onSelect: () => {} });
    expect(screen.getByRole("button", { name: "red" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "blue" })).toBeEnabled();
  });

  it("calls onSelect with the clicked color", async () => {
    const onSelect = vi.fn();
    render(ColorPicker, { takenColors: [], selected: null, onSelect });
    await fireEvent.click(screen.getByRole("button", { name: "blue" }));
    expect(onSelect).toHaveBeenCalledWith("blue");
  });
});
