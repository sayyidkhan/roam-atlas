// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApplicationRuntimeHost } from "../../apps/web/src/app/ApplicationRuntimeHost";

afterEach(cleanup);

describe("ApplicationRuntimeHost", () => {
  it("starts and disposes the compatibility runtime through React lifecycle", async () => {
    const stopRuntime = vi.fn();
    const startApplicationRuntime = vi
      .fn()
      .mockResolvedValue(stopRuntime);
    const applyApplicationRuntimeRoute = vi
      .fn()
      .mockResolvedValue(undefined);
    const loadRuntime = vi.fn().mockResolvedValue({
      applyApplicationRuntimeRoute,
      startApplicationRuntime
    });
    const view = render(
      <MemoryRouter initialEntries={["/singapore"]}>
        <ApplicationRuntimeHost loadRuntime={loadRuntime} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(startApplicationRuntime).toHaveBeenCalledTimes(1);
      expect(applyApplicationRuntimeRoute).toHaveBeenCalledWith(
        "/singapore"
      );
    });

    view.unmount();
    expect(stopRuntime).toHaveBeenCalledTimes(1);
  });

  it("shows runtime startup failures without hiding the React shell", async () => {
    const loadRuntime = vi
      .fn()
      .mockRejectedValue(new Error("Runtime unavailable"));

    render(
      <MemoryRouter>
        <ApplicationRuntimeHost loadRuntime={loadRuntime} />
      </MemoryRouter>
    );

    const alert = await screen.findByText(
      "Runtime unavailable"
    );
    expect(alert.getAttribute("role")).toBe("alert");
    expect(
      screen.getByLabelText("RoamAtlas visual explorer")
    ).toBeTruthy();
  });

  it("applies React Router pathname changes without a global popstate controller", async () => {
    const applyApplicationRuntimeRoute = vi
      .fn()
      .mockResolvedValue(undefined);
    const loadRuntime = vi.fn().mockResolvedValue({
      applyApplicationRuntimeRoute,
      startApplicationRuntime: vi
        .fn()
        .mockResolvedValue(vi.fn())
    });

    function RouteDriver() {
      const navigate = useNavigate();
      return (
        <button
          type="button"
          onClick={() => navigate("/malaysia/config")}
        >
          Open Malaysia
        </button>
      );
    }

    render(
      <MemoryRouter initialEntries={["/singapore"]}>
        <RouteDriver />
        <ApplicationRuntimeHost loadRuntime={loadRuntime} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(applyApplicationRuntimeRoute).toHaveBeenCalledWith(
        "/singapore"
      );
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open Malaysia"
      })
    );
    await waitFor(() => {
      expect(applyApplicationRuntimeRoute).toHaveBeenCalledWith(
        "/malaysia/config"
      );
    });
  });
});
