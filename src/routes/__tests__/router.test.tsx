/** @jest-environment jsdom */
/**
 * Router registration tests for the composite-food-creation routes.
 *
 * Spec: sdd/composite-food-creation — Mode Selection, Manual Creation Flow,
 * Ingredients-Based Creation Flow.
 * Design: design.md — "routes vs modal" decision, dedicated AuthGuard routes.
 *
 * All route-level page components and every store/db-touching dependency are
 * mocked so this test verifies ONLY the route tree structure (paths + that
 * each new route is wrapped in AuthGuard), without importing real DB/store
 * modules that perform I/O on import.
 */
import "@testing-library/jest-dom";

jest.mock("@/src/components/AuthGuard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-guard">{children}</div>
  ),
}));
jest.mock("@/src/layouts/TabLayout", () => ({ TabLayout: () => <div>TabLayout</div> }));
jest.mock("@/src/routes/customFood", () => ({ CustomFoodRoute: () => <div>CustomFood</div> }));
jest.mock("@/src/routes/day", () => ({ DayScreen: () => <div>Day</div> }));
jest.mock("@/src/routes/login", () => ({ LoginRoute: () => <div>Login</div> }));
jest.mock("@/src/routes/onboarding", () => ({ OnboardingRoute: () => <div>Onboarding</div> }));
jest.mock("@/src/routes/portion", () => ({ PortionRoute: () => <div>Portion</div> }));
jest.mock("@/src/routes/profile/configuration", () => ({
  ConfigurationRoute: () => <div>Configuration</div>,
}));
jest.mock("@/src/routes/profile/layout", () => ({ ProfileLayout: () => <div>ProfileLayout</div> }));
jest.mock("@/src/routes/profile/plan", () => ({ PlanRoute: () => <div>Plan</div> }));
jest.mock("@/src/routes/profile/progress", () => ({ ProgressRoute: () => <div>Progress</div> }));
jest.mock("@/src/routes/profile/progressPhotos", () => ({
  ProgressPhotosRoute: () => <div>ProgressPhotos</div>,
}));
jest.mock("@/src/routes/search", () => ({ SearchRoute: () => <div>Search</div> }));
jest.mock("@/src/routes/createFood/ModeSelect", () => ({
  ModeSelectRoute: () => <div>ModeSelect</div>,
}));
jest.mock("@/src/routes/createFood/ManualForm", () => ({
  ManualFormRoute: () => <div>ManualForm</div>,
}));
jest.mock("@/src/routes/createFood/IngredientsBuilder", () => ({
  IngredientsBuilderRoute: () => <div>IngredientsBuilder</div>,
}));
jest.mock("@/src/routes/createFood/IngredientPicker", () => ({
  IngredientPickerRoute: () => <div>IngredientPicker</div>,
}));
jest.mock("@/src/routes/createFood/RecipeDetail", () => ({
  RecipeDetailRoute: () => <div>RecipeDetail</div>,
}));

// biome-ignore lint/suspicious/noExplicitAny: minimal recursive route-tree shape from react-router-dom
type RouteObjectLike = any;

function findRoute(routes: RouteObjectLike[], path: string): RouteObjectLike | undefined {
  for (const route of routes) {
    if (route.path === path) return route;
    if (route.children) {
      const found = findRoute(route.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

/** Detect whether a route's element tree is wrapped by the mocked AuthGuard. */
function isAuthGuarded(route: RouteObjectLike): boolean {
  const element = route.element;
  if (!element) return false;
  const typeName = element.type?.name ?? element.type?.displayName;
  return typeName === "AuthGuard";
}

describe("router.tsx — composite-food-creation route registration", () => {
  it("registers /create-food, wrapped in AuthGuard", async () => {
    const { router } = await import("@/src/router");
    const route = findRoute(router.routes, "/create-food");
    expect(route).toBeDefined();
    expect(isAuthGuarded(route)).toBe(true);
  });

  it("registers /create-food/manual, wrapped in AuthGuard", async () => {
    const { router } = await import("@/src/router");
    const route = findRoute(router.routes, "/create-food/manual");
    expect(route).toBeDefined();
    expect(isAuthGuarded(route)).toBe(true);
  });

  it("registers /create-food/ingredients, wrapped in AuthGuard", async () => {
    const { router } = await import("@/src/router");
    const route = findRoute(router.routes, "/create-food/ingredients");
    expect(route).toBeDefined();
    expect(isAuthGuarded(route)).toBe(true);
  });

  it("registers /create-food/ingredients/add, wrapped in AuthGuard", async () => {
    const { router } = await import("@/src/router");
    const route = findRoute(router.routes, "/create-food/ingredients/add");
    expect(route).toBeDefined();
    expect(isAuthGuarded(route)).toBe(true);
  });

  it("registers /create-food/:foodId/edit, wrapped in AuthGuard", async () => {
    const { router } = await import("@/src/router");
    const route = findRoute(router.routes, "/create-food/:foodId/edit");
    expect(route).toBeDefined();
    expect(isAuthGuarded(route)).toBe(true);
  });

  it("registers /create-food/manual/:foodId, wrapped in AuthGuard", async () => {
    const { router } = await import("@/src/router");
    const route = findRoute(router.routes, "/create-food/manual/:foodId");
    expect(route).toBeDefined();
    expect(isAuthGuarded(route)).toBe(true);
  });
});

describe("router.tsx — progress-photos-gallery route registration", () => {
  it("registers /profile/progress/photos as a TOP-LEVEL route (not nested under profile children), wrapped in AuthGuard", async () => {
    const { router } = await import("@/src/router");

    const route = findRoute(router.routes, "/profile/progress/photos");
    expect(route).toBeDefined();
    expect(isAuthGuarded(route)).toBe(true);

    // Confirm it is NOT a child of the `profile` route (escapes ProfileLayout/TabLayout).
    const profileRoute = findRoute(router.routes, "profile");
    const isChildOfProfile = (profileRoute?.children ?? []).some(
      (child: RouteObjectLike) => child.path === "/profile/progress/photos"
    );
    expect(isChildOfProfile).toBe(false);
  });
});
