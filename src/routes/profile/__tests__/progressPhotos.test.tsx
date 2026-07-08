/** @jest-environment jsdom */
/**
 * Component tests for ProgressPhotosRoute — full-screen gallery escaping
 * TabLayout/ProfileLayout chrome, owning its own back header.
 * Spec: sdd/progress-photos-gallery — "Gallery Route Rendering", lightbox wiring.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

let mockGalleryVM: {
  months: Array<{
    key: string;
    label: string;
    items: Array<{
      entry: {
        date: string;
        weightKg: number | null;
        bodyFatPct: number | null;
        waistCm: number | null;
      };
      photo: { id: string };
      url: string;
    }>;
  }>;
  isLoading: boolean;
};

jest.mock("@/hooks/useProgressPhotoGallery", () => ({
  useProgressPhotoGallery: () => mockGalleryVM,
}));

jest.mock("@/src/components/PhotoLightbox", () => ({
  PhotoLightbox: ({ index, onClose }: { index: number; onClose: () => void }) => (
    <div data-testid="photo-lightbox">
      Lightbox:{index}
      <button type="button" onClick={onClose}>
        CloseLightbox
      </button>
    </div>
  ),
}));

import { ProgressPhotosRoute } from "../progressPhotos";

function makeItem(id: string, date: string) {
  return {
    entry: { date, weightKg: null, bodyFatPct: null, waistCm: null },
    photo: { id },
    url: `blob:mock-${id}`,
  };
}

describe("ProgressPhotosRoute", () => {
  beforeEach(() => {
    mockGalleryVM = { months: [], isLoading: false };
  });

  it("renders an empty state when there are no photos", () => {
    render(
      <MemoryRouter>
        <ProgressPhotosRoute />
      </MemoryRouter>
    );

    expect(screen.getByText(/aún no hay fotos de progreso/i)).toBeInTheDocument();
  });

  it("renders month headers and thumbnails grouped by month", () => {
    mockGalleryVM = {
      months: [
        { key: "2026-07", label: "Julio 2026", items: [makeItem("p1", "2026-07-01")] },
        { key: "2026-06", label: "Junio 2026", items: [makeItem("p2", "2026-06-01")] },
      ],
      isLoading: false,
    };

    render(
      <MemoryRouter>
        <ProgressPhotosRoute />
      </MemoryRouter>
    );

    expect(screen.getByText("Julio 2026")).toBeInTheDocument();
    expect(screen.getByText("Junio 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("does not render the empty state when photos exist", () => {
    mockGalleryVM = {
      months: [{ key: "2026-07", label: "Julio 2026", items: [makeItem("p1", "2026-07-01")] }],
      isLoading: false,
    };

    render(
      <MemoryRouter>
        <ProgressPhotosRoute />
      </MemoryRouter>
    );

    expect(screen.queryByText(/aún no hay fotos de progreso/i)).not.toBeInTheDocument();
  });

  it("opens the lightbox at the correct flattened index when a thumbnail is tapped", () => {
    mockGalleryVM = {
      months: [
        {
          key: "2026-07",
          label: "Julio 2026",
          items: [makeItem("p1", "2026-07-02"), makeItem("p2", "2026-07-01")],
        },
      ],
      isLoading: false,
    };

    render(
      <MemoryRouter>
        <ProgressPhotosRoute />
      </MemoryRouter>
    );

    const thumbnails = screen.getAllByRole("img");
    fireEvent.click(thumbnails[1]);

    expect(screen.getByTestId("photo-lightbox")).toHaveTextContent("Lightbox:1");
  });

  it("closes the lightbox when onClose fires", () => {
    mockGalleryVM = {
      months: [{ key: "2026-07", label: "Julio 2026", items: [makeItem("p1", "2026-07-01")] }],
      isLoading: false,
    };

    render(
      <MemoryRouter>
        <ProgressPhotosRoute />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole("img")[0]);
    expect(screen.getByTestId("photo-lightbox")).toBeInTheDocument();

    fireEvent.click(screen.getByText("CloseLightbox"));
    expect(screen.queryByTestId("photo-lightbox")).not.toBeInTheDocument();
  });

  it("renders a back control", () => {
    render(
      <MemoryRouter>
        <ProgressPhotosRoute />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /volver/i })).toBeInTheDocument();
  });
});
