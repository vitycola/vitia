/** @jest-environment jsdom */
import { deliverFile } from "../exportDelivery";

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

function makeNav(over: Record<string, unknown> = {}): Navigator {
  return { userAgent: "Mozilla/5.0 (Macintosh)", ...over } as unknown as Navigator;
}

const blob = new Blob(["a,b"], { type: "text/csv;charset=utf-8" });

describe("deliverFile", () => {
  let createObjectURL: jest.Mock;
  let revokeObjectURL: jest.Mock;

  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    jest.useFakeTimers();
    createObjectURL = jest.fn(() => "blob:mock");
    revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    Object.assign(URL, { createObjectURL: originalCreate, revokeObjectURL: originalRevoke });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("downloads through a temporary anchor and cleans up", async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    let seen: HTMLAnchorElement | null = null;
    click.mockImplementation(function (this: HTMLAnchorElement) {
      seen = this;
      expect(document.body.contains(this)).toBe(true);
    });

    const result = await deliverFile(blob, "vitia-a_b.csv", { nav: makeNav(), doc: document });

    expect(result).toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
    expect((seen as unknown as HTMLAnchorElement).download).toBe("vitia-a_b.csv");
    expect((seen as unknown as HTMLAnchorElement).href).toContain("blob:mock");
    expect(document.body.contains(seen)).toBe(false);
    jest.advanceTimersByTime(59_999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("shares a File on iOS standalone when canShare({files}) is true", async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const canShare = jest.fn(() => true);
    const nav = makeNav({ userAgent: IOS_UA, standalone: true, share, canShare });

    const result = await deliverFile(blob, "vitia-a_b.csv", { nav, doc: document });

    expect(result).toBe("shared");
    const arg = share.mock.calls[0][0] as { files: File[] };
    expect(arg.files[0]).toBeInstanceOf(File);
    expect(arg.files[0].name).toBe("vitia-a_b.csv");
    expect(arg.files[0].type).toBe("text/csv;charset=utf-8");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("falls back to the anchor on desktop even when share exists", async () => {
    const share = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const nav = makeNav({ share, canShare: () => true });
    expect(await deliverFile(blob, "x.csv", { nav, doc: document })).toBe("downloaded");
    expect(share).not.toHaveBeenCalled();
  });

  it("treats an AbortError as cancelled without throwing", async () => {
    const abort = Object.assign(new Error("cancel"), { name: "AbortError" });
    const nav = makeNav({
      userAgent: IOS_UA,
      standalone: true,
      share: jest.fn().mockRejectedValue(abort),
      canShare: () => true,
    });
    expect(await deliverFile(blob, "x.csv", { nav, doc: document })).toBe("cancelled");
  });

  it("returns needs-share on iOS standalone when share is rejected with NotAllowedError", async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    const share = jest.fn().mockRejectedValue(denied);
    const nav = makeNav({ userAgent: IOS_UA, standalone: true, share, canShare: () => true });

    expect(await deliverFile(blob, "x.csv", { nav, doc: document })).toBe("needs-share");
    expect(share).toHaveBeenCalledTimes(1);
    expect(click).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("returns needs-share on iOS standalone for any non-abort share failure", async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const nav = makeNav({
      userAgent: IOS_UA,
      standalone: true,
      share: jest.fn().mockRejectedValue(new Error("boom")),
      canShare: () => true,
    });
    expect(await deliverFile(blob, "x.csv", { nav, doc: document })).toBe("needs-share");
    expect(click).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("keeps the anchor download on non-iOS when canShare is false", async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const share = jest.fn();
    const nav = makeNav({ standalone: true, share, canShare: () => false });
    expect(await deliverFile(blob, "x.csv", { nav, doc: document })).toBe("downloaded");
    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("shares on iPadOS, which reports a Macintosh user agent", async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const nav = makeNav({
      platform: "MacIntel",
      maxTouchPoints: 5,
      standalone: true,
      share,
      canShare: () => true,
    });
    expect(await deliverFile(blob, "x.csv", { nav, doc: document })).toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("keeps desktop Mac (no touch points) on the anchor download", async () => {
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const share = jest.fn();
    const nav = makeNav({
      platform: "MacIntel",
      maxTouchPoints: 0,
      standalone: true,
      share,
      canShare: () => true,
    });
    expect(await deliverFile(blob, "x.csv", { nav, doc: document })).toBe("downloaded");
    expect(share).not.toHaveBeenCalled();
  });

  it("throws when no delivery path is possible", async () => {
    Object.assign(URL, { createObjectURL: undefined });
    await expect(deliverFile(blob, "x.csv", { nav: makeNav(), doc: document })).rejects.toThrow(
      /descarg/i
    );
  });
});
