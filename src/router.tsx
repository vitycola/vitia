import { AuthGuard } from "@/src/components/AuthGuard";
import { TabLayout } from "@/src/layouts/TabLayout";
import { CustomFoodRoute } from "@/src/routes/customFood";
import { DayScreen } from "@/src/routes/day";
import { LoginRoute } from "@/src/routes/login";
import { OnboardingRoute } from "@/src/routes/onboarding";
import { PortionRoute } from "@/src/routes/portion";
import { ConfigurationRoute } from "@/src/routes/profile/configuration";
import { ProfileLayout } from "@/src/routes/profile/layout";
import { PlanRoute } from "@/src/routes/profile/plan";
import { ProgressRoute } from "@/src/routes/profile/progress";
import { SearchRoute } from "@/src/routes/search";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  // Public routes
  { path: "/login", element: <LoginRoute /> },

  // Protected routes — wrapped in AuthGuard
  {
    path: "/",
    element: (
      <AuthGuard>
        <TabLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DayScreen /> },
      { path: "search", element: <SearchRoute /> },
      {
        path: "profile",
        element: <ProfileLayout />,
        children: [
          { index: true, element: <ConfigurationRoute /> },
          { path: "plan", element: <PlanRoute /> },
          { path: "progress", element: <ProgressRoute /> },
        ],
      },
    ],
  },
  {
    path: "/onboarding",
    element: (
      <AuthGuard>
        <OnboardingRoute />
      </AuthGuard>
    ),
  },
  {
    path: "/portion/:foodId",
    element: (
      <AuthGuard>
        <PortionRoute />
      </AuthGuard>
    ),
  },
  {
    path: "/custom-food",
    element: (
      <AuthGuard>
        <CustomFoodRoute />
      </AuthGuard>
    ),
  },
]);
