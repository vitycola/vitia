import { TabLayout } from "@/src/layouts/TabLayout";
import { CustomFoodRoute } from "@/src/routes/customFood";
import { DayScreen } from "@/src/routes/day";
import { OnboardingRoute } from "@/src/routes/onboarding";
import { PortionRoute } from "@/src/routes/portion";
import { ProfileRoute } from "@/src/routes/profile";
import { SearchRoute } from "@/src/routes/search";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <TabLayout />,
    children: [
      { index: true, element: <DayScreen /> },
      { path: "search", element: <SearchRoute /> },
      { path: "profile", element: <ProfileRoute /> },
    ],
  },
  { path: "/onboarding", element: <OnboardingRoute /> },
  { path: "/portion/:foodId", element: <PortionRoute /> },
  { path: "/custom-food", element: <CustomFoodRoute /> },
]);
