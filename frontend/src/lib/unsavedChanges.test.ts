import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmLeave, setUnsavedChanges } from "@/lib/unsavedChanges";

describe("confirmLeave", () => {
  afterEach(() => {
    setUnsavedChanges(false);
    vi.unstubAllGlobals();
  });

  it("leaves without asking when everything is saved", () => {
    const confirm = vi.fn();
    vi.stubGlobal("window", { confirm });

    expect(confirmLeave()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each([true, false])("asks first when there are unsaved changes (user answers %s)", (answer) => {
    const confirm = vi.fn().mockReturnValue(answer);
    vi.stubGlobal("window", { confirm });
    setUnsavedChanges(true);

    expect(confirmLeave()).toBe(answer);
    expect(confirm).toHaveBeenCalledOnce();
  });
});
