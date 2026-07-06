/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProgressEntrySheet } from "../ProgressEntrySheet";

describe("ProgressEntrySheet", () => {
  it("renders an empty form with the create-mode header", () => {
    render(<ProgressEntrySheet mode="create" onSave={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Añadir progreso")).toBeInTheDocument();
    expect(screen.getByLabelText(/Peso/)).toHaveValue(null);
  });

  it("renders pre-filled with the edit-mode header when initial values are given", () => {
    render(
      <ProgressEntrySheet
        mode="edit"
        initial={{ weightKg: 70, neckCm: 38, waistCm: 85 }}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText("Editar progreso")).toBeInTheDocument();
    expect(screen.getByLabelText(/Peso/)).toHaveValue(70);
    expect(screen.getByLabelText(/Cuello/)).toHaveValue(38);
    expect(screen.getByLabelText(/Cintura/)).toHaveValue(85);
  });

  it("blocks submit and shows a validation error when all fields are empty", async () => {
    const onSave = jest.fn();
    render(<ProgressEntrySheet mode="create" onSave={onSave} onClose={jest.fn()} />);

    fireEvent.click(screen.getByText("Guardar"));

    expect(await screen.findByText(/Ingresá al menos un dato/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onSave with the ProgressInput shape when weight alone is filled", async () => {
    const onSave = jest.fn();
    render(<ProgressEntrySheet mode="create" onSave={onSave} onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Peso/), { target: { value: "70" } });
    fireEvent.click(screen.getByText("Guardar"));

    await screen.findByText("Guardar");
    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0][0];
    expect(arg.weightKg).toBe(70);
    expect(arg.photos).toEqual([]);
  });

  it("calls onClose, not onSave, when Cancelar is clicked", () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    render(<ProgressEntrySheet mode="create" onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("converts selected files into Blobs merged into the save payload", async () => {
    const onSave = jest.fn();
    render(<ProgressEntrySheet mode="create" onSave={onSave} onClose={jest.fn()} />);

    const file = new File(["fake-image-bytes"], "photo.png", { type: "image/png" });
    const input = screen.getByLabelText(/foto/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByText("Guardar"));

    await screen.findByText("Guardar");
    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0][0];
    expect(arg.photos).toHaveLength(1);
    expect(arg.photos[0].mimeType).toBe("image/png");
    expect(arg.photos[0].blob).toBeInstanceOf(Blob);
  });

  it("renders Pecho/Brazo/Muslo fields inside the Medidas corporales section", () => {
    render(<ProgressEntrySheet mode="create" onSave={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByLabelText(/Pecho/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Brazo/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Muslo/)).toBeInTheDocument();
  });

  it("pre-fills chestCm/armCm/thighCm in edit mode", () => {
    render(
      <ProgressEntrySheet
        mode="edit"
        initial={{ chestCm: 100, armCm: 32, thighCm: 55 }}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByLabelText(/Pecho/)).toHaveValue(100);
    expect(screen.getByLabelText(/Brazo/)).toHaveValue(32);
    expect(screen.getByLabelText(/Muslo/)).toHaveValue(55);
  });

  it("includes chestCm/armCm/thighCm in the save payload when filled", async () => {
    const onSave = jest.fn();
    render(<ProgressEntrySheet mode="create" onSave={onSave} onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Pecho/), { target: { value: "100" } });
    fireEvent.click(screen.getByText("Guardar"));

    await screen.findByText("Guardar");
    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0][0];
    expect(arg.chestCm).toBe(100);
  });

  it("renders existing photo thumbnails when existingPhotos is provided (regression-proof)", () => {
    render(
      <ProgressEntrySheet
        mode="edit"
        existingPhotos={[
          { id: "p1", url: "blob:mock-url-1" },
          { id: "p2", url: "blob:mock-url-2" },
        ]}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const thumbnails = screen.getAllByRole("img");
    expect(thumbnails).toHaveLength(2);
    expect(thumbnails[0]).toHaveAttribute("src", "blob:mock-url-1");
    expect(thumbnails[1]).toHaveAttribute("src", "blob:mock-url-2");
  });
});
