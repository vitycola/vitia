import { useNavigate } from "react-router-dom";

export function ModeSelectRoute() {
  const navigate = useNavigate();

  function handleCancel() {
    void navigate(-1 as unknown as string);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            ← Cancelar
          </button>
        </div>

        <h1 className="mb-2 text-xl font-bold text-gray-900">Crear alimento</h1>
        <p className="mb-6 text-sm text-gray-500">Elige cómo quieres crear tu alimento.</p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate("/create-food/manual")}
            className="flex flex-col items-start gap-1 rounded-xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm transition-colors hover:border-accent hover:bg-accent/5"
          >
            <span className="text-base font-semibold text-gray-900">Manual</span>
            <span className="text-sm text-gray-500">
              Introduce el nombre, la categoría y los valores nutricionales a mano.
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/create-food/ingredients")}
            className="flex flex-col items-start gap-1 rounded-xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm transition-colors hover:border-accent hover:bg-accent/5"
          >
            <span className="text-base font-semibold text-gray-900">Basado en ingredientes</span>
            <span className="text-sm text-gray-500">
              Combina alimentos existentes para crear una receta con macros calculadas
              automáticamente.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
