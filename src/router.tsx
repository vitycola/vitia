import { AuthGuard } from "@/src/components/AuthGuard";
import { TabLayout } from "@/src/layouts/TabLayout";
import { IngredientPickerRoute } from "@/src/routes/createFood/IngredientPicker";
import { IngredientsBuilderRoute } from "@/src/routes/createFood/IngredientsBuilder";
import { ManualFormRoute } from "@/src/routes/createFood/ManualForm";
import { ModeSelectRoute } from "@/src/routes/createFood/ModeSelect";
import { RecipeDetailRoute } from "@/src/routes/createFood/RecipeDetail";
import { CustomFoodRoute } from "@/src/routes/customFood";
import { DayScreen } from "@/src/routes/day";
import { LoginRoute } from "@/src/routes/login";
import { OnboardingRoute } from "@/src/routes/onboarding";
import { PortionRoute } from "@/src/routes/portion";
import { ConfigurationRoute } from "@/src/routes/profile/configuration";
import { ProfileLayout } from "@/src/routes/profile/layout";
import { PlanRoute } from "@/src/routes/profile/plan";
import { ProgressRoute } from "@/src/routes/profile/progress";
import { ProgressPhotosRoute } from "@/src/routes/profile/progressPhotos";
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
    // Escapes TabLayout/ProfileLayout chrome (no bottom tab bar, no profile
    // RouteTabs header) — a full-screen gallery/lightbox owns its own back
    // header instead. Mirrors the /portion/:foodId escape pattern above.
    path: "/profile/progress/photos",
    element: (
      <AuthGuard>
        <ProgressPhotosRoute />
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
  {
    path: "/create-food",
    element: (
      <AuthGuard>
        <ModeSelectRoute />
      </AuthGuard>
    ),
  },
  {
    path: "/create-food/manual",
    element: (
      <AuthGuard>
        <ManualFormRoute />
      </AuthGuard>
    ),
  },
  {
    path: "/create-food/manual/:foodId",
    element: (
      <AuthGuard>
        <ManualFormRoute />
      </AuthGuard>
    ),
  },
  {
    path: "/create-food/ingredients",
    element: (
      <AuthGuard>
        <IngredientsBuilderRoute />
      </AuthGuard>
    ),
  },
  {
    path: "/create-food/ingredients/add",
    element: (
      <AuthGuard>
        <IngredientPickerRoute />
      </AuthGuard>
    ),
  },
  {
    path: "/create-food/:foodId/edit",
    element: (
      <AuthGuard>
        <RecipeDetailRoute />
      </AuthGuard>
    ),
  },
]);
