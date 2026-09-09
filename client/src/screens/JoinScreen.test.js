import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import JoinScreen from "./JoinScreen.svelte";

describe("JoinScreen", () => {
  it("calls onJoin with the entered name and selected color", async () => {
    const onJoin = vi.fn();
    render(JoinScreen, { takenColors: [], onJoin });

    await fireEvent.input(screen.getByLabelText("Nom"), { target: { value: "Alice" } });
    await fireEvent.click(screen.getByRole("button", { name: "red" }));
    await fireEvent.click(screen.getByRole("button", { name: "Rejoindre" }));

    expect(onJoin).toHaveBeenCalledWith("Alice", "red");
  });

  it("disables the join button until a name and color are chosen", async () => {
    render(JoinScreen, { takenColors: [], onJoin: () => {} });
    expect(screen.getByRole("button", { name: "Rejoindre" })).toBeDisabled();
  });
});
