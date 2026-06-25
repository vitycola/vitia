import { TabLayout } from "@/src/layouts/TabLayout";
import { DayScreen } from "@/src/routes/day";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <TabLayout />,
    children: [
      {
        index: true,
        element: <DayScreen />,
      },
      {
        path: "search",
        element: <div className="p-8 text-center text-gray-500">Buscar — próximamente</div>,
      },
      {
        path: "profile",
        element: <div className="p-8 text-center text-gray-500">Perfil — próximamente</div>,
      },
    ],
  },
]);
