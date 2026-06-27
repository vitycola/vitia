import { AuthGuard } from "@/src/components/AuthGuard";
import { TabLayout } from "@/src/layouts/TabLayout";
import { CustomFoodRoute } from "@/src/routes/customFood";
import { DayScreen } from "@/src/routes/day";
import { LoginRoute } from "@/src/routes/login";
import { OnboardingRoute } from "@/src/routes/onboarding";
import { PortionRoute } from "@/src/routes/portion";
import { ProfileRoute } from "@/src/routes/profile";
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
      { path: "profile", element: <ProfileRoute /> },
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
