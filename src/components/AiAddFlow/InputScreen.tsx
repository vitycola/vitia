import { compressImage } from "@/lib/compressImage";
import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { useRef, useState } from "react";
import { useShallow } from "zustand/shallow";

const MEAL_SECTIONS = [
  { key: "breakfast", label: "Desayuno" },
  { key: "lunch", label: "Almuerzo" },
  { key: "dinner", label: "Cena" },
  { key: "snack", label: "Snack" },
] as const;

type MealKey = (typeof MEAL_SECTIONS)[number]["key"];

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
  const [mealTexts, setMealTexts] = useState<Record<MealKey, string>>({
    breakfast: "",
    lunch: "",
    dinner: "",
    snack: "",
  });
  const [offlineWarning, setOfflineWarning] = useState(false);

  // Two separate inputs: gallery (no capture) and camera (capture=environment)
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isLoading = status === "loading";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  function handleMealText(key: MealKey, value: string) {
    setMealTexts((prev) => ({ ...prev, [key]: value }));
  }

  const combinedText = MEAL_SECTIONS.filter(({ key }) => mealTexts[key].trim())
    .map(({ label, key }) => `${label}: ${mealTexts[key].trim()}`)
    .join("\n");

  const canSubmitText = combinedText.length > 0;

  function handleSubmit() {
    if (!navigator.onLine) {
      setOfflineWarning(true);
      return;
    }
    setOfflineWarning(false);
    if (inputMode === "photo" && selectedFile) {
      void compressImage(selectedFile).then((compressed) => submitPhoto(compressed));
    } else if (inputMode === "text" && canSubmitText) {
      void submitText(combinedText);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {inputMode === "photo" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-700">Selecciona una foto de tu comida</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex-1 rounded-xl border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 transition-colors active:bg-gray-50"
            >
              Galería
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 rounded-xl border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 transition-colors active:bg-gray-50"
            >
              Cámara
            </button>
          </div>
          {/* Gallery: no capture attribute */}
          <input
            ref={galleryInputRef}
            data-testid="photo-file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {/* Camera: capture=environment declared statically so iOS respects it */}
          <input
            ref={cameraInputRef}
            data-testid="camera-file-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          {selectedFile && <p className="text-xs text-gray-500">Archivo: {selectedFile.name}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="mb-2 text-sm text-gray-500">✏️ Escribe un alimento por línea</p>
          {MEAL_SECTIONS.map(({ key, label }) => (
            <div key={key} className="mb-3">
              <p className="mb-1 text-base font-bold text-gray-900">{label}</p>
              <textarea
                value={mealTexts[key]}
                onChange={(e) => handleMealText(key, e.target.value)}
                placeholder={`Añade alimentos de ${label.toLowerCase()}...`}
                rows={2}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          ))}
        </div>
      )}

      {status === "error" && error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {offlineWarning && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          La IA requiere conexión a internet.
        </p>
      )}

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
