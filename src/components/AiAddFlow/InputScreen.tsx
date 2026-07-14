import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { useRef, useState } from "react";
import { useShallow } from "zustand/shallow";

export function InputScreen() {
  const { inputMode, status, error, submitPhoto, submitText } = useAiAddFlowStore(
    useShallow((s) => ({
      inputMode: s.inputMode,
      status: s.status,
      error: s.error,
      submitPhoto: s.submitPhoto,
      submitText: s.submitText,
    }))
  );

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textValue, setTextValue] = useState("");
  const [offlineWarning, setOfflineWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = status === "loading";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  function handleSubmit() {
    if (!navigator.onLine) {
      setOfflineWarning(true);
      return;
    }
    setOfflineWarning(false);
    if (inputMode === "photo" && selectedFile) {
      void submitPhoto(selectedFile);
    } else if (inputMode === "text" && textValue.trim()) {
      void submitText(textValue.trim());
    }
  }

  const canSubmitText = inputMode === "text" && textValue.trim().length > 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      {inputMode === "photo" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-700">Seleccioná una foto de tu comida</p>
          <div className="flex gap-2">
            {/* Standard file picker */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-xl border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 transition-colors active:bg-gray-50"
            >
              Galería
            </button>
            {/* Camera capture — degrades silently on desktop */}
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute("capture", "environment");
                  fileInputRef.current.click();
                }
              }}
              className="flex-1 rounded-xl border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 transition-colors active:bg-gray-50"
            >
              Cámara
            </button>
          </div>
          <input
            ref={fileInputRef}
            data-testid="photo-file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {selectedFile && <p className="text-xs text-gray-500">Archivo: {selectedFile.name}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-700">Escribí los alimentos que comiste</p>
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Ej: 200g de pollo a la plancha, ensalada mixta con aceite..."
            rows={5}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {["200g de pollo", "1 taza de arroz", "100ml de leche"].map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-gray-500"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Offline warning */}
      {offlineWarning && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          IA requiere conexión a internet.
        </p>
      )}

      {/* Submit CTA */}
      {inputMode === "photo" ? (
        selectedFile && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {isLoading ? "Analizando..." : "Analizar con IA"}
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmitText || isLoading}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {isLoading ? "Analizando..." : "Analizar con IA"}
        </button>
      )}
    </div>
  );
}
