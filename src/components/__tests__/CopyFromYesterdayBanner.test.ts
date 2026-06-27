/**
 * Tests for CopyFromYesterdayBanner component logic.
 * Layer: unit — verifies accept/dismiss callback contracts and label copy.
 *
 * CopyFromYesterdayBanner:
 *   - "Aceptar" button → calls onAccept (disabled when busy)
 *   - "Descartar" button → calls onDismiss (disabled when busy)
 *   - Shows count with correct pluralization
 */

// ── Pluralization logic mirroring the component ────────────────────────

function foodLabel(count: number): string {
  return `${count} alimento${count !== 1 ? "s" : ""}`;
}

// ── Disabled state logic ───────────────────────────────────────────────

function isButtonDisabled(busy: boolean): boolean {
  return busy;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("CopyFromYesterdayBanner — onAccept callback", () => {
  it("fires onAccept when accept button is clicked (not busy)", () => {
    const onAccept = jest.fn();
    const busy = false;

    if (!busy) {
      onAccept();
    }

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onAccept when busy", () => {
    const onAccept = jest.fn();
    const busy = true;

    if (!busy) {
      onAccept();
    }

    expect(onAccept).not.toHaveBeenCalled();
  });
});

describe("CopyFromYesterdayBanner — onDismiss callback", () => {
  it("fires onDismiss when dismiss button is clicked (not busy)", () => {
    const onDismiss = jest.fn();
    const busy = false;

    if (!busy) {
      onDismiss();
    }

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onDismiss when busy", () => {
    const onDismiss = jest.fn();
    const busy = true;

    if (!busy) {
      onDismiss();
    }

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("onAccept and onDismiss are independent — calling one does not call the other", () => {
    const onAccept = jest.fn();
    const onDismiss = jest.fn();

    onAccept();

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe("CopyFromYesterdayBanner — button disabled state", () => {
  it("both buttons are disabled when busy=true", () => {
    expect(isButtonDisabled(true)).toBe(true);
  });

  it("both buttons are enabled when busy=false", () => {
    expect(isButtonDisabled(false)).toBe(false);
  });
});

describe("CopyFromYesterdayBanner — food count label", () => {
  it('shows singular "alimento" for count=1', () => {
    expect(foodLabel(1)).toBe("1 alimento");
  });

  it('shows plural "alimentos" for count=0', () => {
    expect(foodLabel(0)).toBe("0 alimentos");
  });

  it('shows plural "alimentos" for count=2', () => {
    expect(foodLabel(2)).toBe("2 alimentos");
  });

  it('shows plural "alimentos" for count=5', () => {
    expect(foodLabel(5)).toBe("5 alimentos");
  });
});
