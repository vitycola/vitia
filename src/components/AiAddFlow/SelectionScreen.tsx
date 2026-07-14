import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { useShallow } from "zustand/shallow";

export function SelectionScreen() {
  const { chooseMode } = useAiAddFlowStore(useShallow((s) => ({ chooseMode: s.chooseMode })));

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-center text-lg font-semibold text-gray-900">
        ¿Cómo quieres añadir tus alimentos?
      </h2>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => chooseMode("photo")}
          className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-colors active:bg-gray-50"
        >
          <span className="text-3xl">📷</span>
          <div>
            <p className="font-semibold text-gray-900">Foto</p>
            <p className="text-sm text-gray-500">Haz una foto de tu comida</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => chooseMode("text")}
          className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-colors active:bg-gray-50"
        >
          <span className="text-3xl">📝</span>
          <div>
            <p className="font-semibold text-gray-900">Lista de texto</p>
            <p className="text-sm text-gray-500">Escribe lo que has comido</p>
          </div>
        </button>
      </div>
    </div>
  );
}
