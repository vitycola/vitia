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

  beforeEach(() => {
    jest.useFakeTimers();
    createObjectURL = jest.fn(() => "blob:mock");
    revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
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
    jest.runAllTimers();
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

  it("propagates non-abort share errors", async () => {
    const nav = makeNav({
      userAgent: IOS_UA,
      standalone: true,
      share: jest.fn().mockRejectedValue(new Error("boom")),
      canShare: () => true,
    });
    await expect(deliverFile(blob, "x.csv", { nav, doc: document })).rejects.toThrow("boom");
  });

  it("throws when no delivery path is possible", async () => {
    Object.assign(URL, { createObjectURL: undefined });
    await expect(deliverFile(blob, "x.csv", { nav: makeNav(), doc: document })).rejects.toThrow(
      /descarg/i
    );
  });
});
