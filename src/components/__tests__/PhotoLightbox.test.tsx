/** @jest-environment jsdom */
/**
 * Unit tests for PhotoLightbox — full-screen photo detail dialog.
 * Spec: sdd/progress-photos-gallery — "Photo Detail / Lightbox Behavior".
 */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { GalleryItem } from "@/hooks/useProgressPhotoGallery";
import { PhotoLightbox } from "../PhotoLightbox";

function makeItem(overrides: Partial<GalleryItem["entry"]> = {}, url = "blob:mock-1"): GalleryItem {
  return {
    entry: {
      id: "e1",
      userId: null,
      date: "2026-07-01",
      weightKg: null,
      neckCm: null,
      chestCm: null,
      armCm: null,
      waistCm: null,
      hipCm: null,
      thighCm: null,
      bodyFatPct: null,
      notes: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      photos: [],
      ...overrides,
    },
    photo: { id: "p1", entryId: "e1", blob: new Blob(), mimeType: "image/png", position: 0 },
    url,
  };
}

describe("PhotoLightbox", () => {
  it("renders as a dialog with the photo and full stats when all three metrics are logged", () => {
    const item = makeItem({ weightKg: 80, bodyFatPct: 18.456, waistCm: 85 });

    render(
      <PhotoLightbox
        items={[item]}
        index={0}
        onClose={jest.fn()}
        onNavigate={jest.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("80 kg")).toBeInTheDocument();
    expect(screen.getByText("18.5 %")).toBeInTheDocument();
    expect(screen.getByText("85 cm")).toBeInTheDocument();
  });

  it("renders dashes for any metric not logged that day, without crashing", () => {
    const item = makeItem({ weightKg: 79, bodyFatPct: null, waistCm: null });

    render(
      <PhotoLightbox items={[item]} index={0} onClose={jest.fn()} onNavigate={jest.fn()} />
    );

    expect(screen.getByText("79 kg")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("renders three dashes when no metrics were logged that day (photo-only day is valid)", () => {
    const item = makeItem({ weightKg: null, bodyFatPct: null, waistCm: null });

    render(
      <PhotoLightbox items={[item]} index={0} onClose={jest.fn()} onNavigate={jest.fn()} />
    );

    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("calls onClose when the close control is activated", () => {
    const onClose = jest.fn();
    render(
      <PhotoLightbox items={[makeItem()]} index={0} onClose={onClose} onNavigate={jest.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onNavigate with the next index when the next chevron is tapped", () => {
    const onNavigate = jest.fn();
    const items = [makeItem({ date: "2026-07-01" }), makeItem({ date: "2026-07-02" })];

    render(
      <PhotoLightbox items={items} index={0} onClose={jest.fn()} onNavigate={onNavigate} />
    );

    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("calls onNavigate with the previous index when the prev chevron is tapped", () => {
    const onNavigate = jest.fn();
    const items = [makeItem({ date: "2026-07-01" }), makeItem({ date: "2026-07-02" })];

    render(
      <PhotoLightbox items={items} index={1} onClose={jest.fn()} onNavigate={onNavigate} />
    );

    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));

    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  it("does not render a prev chevron on the first photo", () => {
    const items = [makeItem({ date: "2026-07-01" }), makeItem({ date: "2026-07-02" })];

    render(
      <PhotoLightbox items={items} index={0} onClose={jest.fn()} onNavigate={jest.fn()} />
    );

    expect(screen.queryByRole("button", { name: /anterior/i })).not.toBeInTheDocument();
  });

  it("does not render a next chevron on the last photo", () => {
    const items = [makeItem({ date: "2026-07-01" }), makeItem({ date: "2026-07-02" })];

    render(
      <PhotoLightbox items={items} index={1} onClose={jest.fn()} onNavigate={jest.fn()} />
    );

    expect(screen.queryByRole("button", { name: /siguiente/i })).not.toBeInTheDocument();
  });

  it("renders the photo's img element with the item's object URL", () => {
    const item = makeItem({}, "blob:mock-photo-url");

    render(
      <PhotoLightbox items={[item]} index={0} onClose={jest.fn()} onNavigate={jest.fn()} />
    );

    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:mock-photo-url");
  });
});
