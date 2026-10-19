/** @jest-environment jsdom */
/**
 * SearchRoute component test: query and tab persistence through the URL.
 * Real MemoryRouter; store and tab bodies are stubbed so everything is sync.
 */
import { SearchRoute } from "@/src/routes/search";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

const mockSearch = jest.fn();
const mockClear = jest.fn();
jest.mock("@/stores/useFoodSearchStore", () => ({
  useFoodSearchStore: () => ({ search: mockSearch, clear: mockClear }),
}));

jest.mock("@/src/components/AiAddFlow/AiAddFlow", () => ({
  AiAddFlow: () => <div>ai-marker</div>,
}));
jest.mock("@/src/components/search/FoodDatabaseTab", () => ({
  FoodDatabaseTab: ({ onSelect }: { onSelect: (f: { id: string }) => void }) => (
    <div>
      <span>database-marker</span>
      <button type="button" onClick={() => onSelect({ id: "f1" })}>
        select-food
      </button>
    </div>
  ),
}));
jest.mock("@/src/components/search/FavoritesTab", () => ({
  FavoritesTab: ({ onSelect }: { onSelect: (f: { id: string }) => void }) => (
    <div>
      <span>favorites-marker</span>
      <button type="button" onClick={() => onSelect({ id: "f1" })}>
        select-food
      </button>
    </div>
  ),
}));
jest.mock("@/src/components/search/CreatedFoodsTab", () => ({
  CreatedFoodsTab: ({ onSelect }: { onSelect: (f: { id: string }) => void }) => (
    <div>
      <span>created-marker</span>
      <button type="button" onClick={() => onSelect({ id: "f1" })}>
        select-food
      </button>
    </div>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function Layout() {
  const navigate = useNavigate();
  return (
    <div>
      <NavLink to="/search">tab-bar-search</NavLink>
      <button type="button" onClick={() => void navigate(-1)}>
        history-back
      </button>
      <Outlet />
    </div>
  );
}

function Portion() {
  const navigate = useNavigate();
  return (
    <div>
      <span>portion-marker</span>
      <button type="button" onClick={() => void navigate(-1)}>
        portion-back
      </button>
      <button type="button" onClick={() => void navigate("/")}>
        portion-confirm
      </button>
    </div>
  );
}

function Home() {
  return (
    <div>
      <span>home-marker</span>
      <NavLink to="/search?meal=lunch">open-search</NavLink>
    </div>
  );
}

function renderSearch(initialSearch = "?meal=lunch") {
  return render(
    <MemoryRouter initialEntries={["/", `/search${initialSearch}`]} initialIndex={1}>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/portion/:foodId" element={<Portion />} />
        <Route element={<Layout />}>
          <Route path="/search" element={<SearchRoute />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value });
}

function params(): URLSearchParams {
  const text = screen.getByTestId("location").textContent ?? "";
  return new URLSearchParams(text.split("?")[1] ?? "");
}

function input(): HTMLInputElement {
  return screen.getByPlaceholderText("Nombre del alimento...") as HTMLInputElement;
}

function type(value: string) {
  fireEvent.change(input(), { target: { value } });
}

function tick() {
  act(() => {
    jest.advanceTimersByTime(300);
  });
}

describe("SearchRoute persistence", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSearch.mockReset();
    mockClear.mockReset();
    setOnLine(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("T1 hydrates input and tab from the URL and re-searches on mount", () => {
    renderSearch("?meal=lunch&q=arroz&tab=database");
    expect(input().value).toBe("arroz");
    expect(screen.getByText("database-marker")).toBeTruthy();
    expect(mockSearch).toHaveBeenCalledWith("arroz");
  });

  it("T2 typing writes q after the debounce and keeps meal", () => {
    renderSearch();
    type("arroz");
    expect(params().get("q")).toBeNull();
    tick();
    expect(params().get("q")).toBe("arroz");
    expect(params().get("meal")).toBe("lunch");
    expect(mockSearch).toHaveBeenCalledWith("arroz");
  });

  it("T3 syncs use replace: back after several ticks leaves search", () => {
    renderSearch();
    type("a");
    tick();
    type("ar");
    tick();
    type("arr");
    tick();
    expect(params().get("q")).toBe("arr");
    fireEvent.click(screen.getByText("history-back"));
    expect(screen.getByText("home-marker")).toBeTruthy();
  });

  it("S4 clearing the input removes q and keeps meal and tab", () => {
    renderSearch("?meal=lunch&q=arroz&tab=favorites");
    type("");
    tick();
    expect(params().get("q")).toBeNull();
    expect(params().get("meal")).toBe("lunch");
    expect(params().get("tab")).toBe("favorites");
  });

  it("T5 an unknown tab falls back to database", () => {
    renderSearch("?meal=lunch&tab=bogus");
    expect(screen.getByText("database-marker")).toBeTruthy();
  });

  it("S6 offline mount restores input and tab without searching", () => {
    setOnLine(false);
    renderSearch("?meal=lunch&q=arroz&tab=favorites");
    expect(input().value).toBe("arroz");
    expect(screen.getByText("favorites-marker")).toBeTruthy();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it.each(["favorites", "created"])("S7 round trip restores state on the %s tab", (tab) => {
    renderSearch(`?meal=lunch&q=arroz&tab=${tab}`);
    mockSearch.mockClear();
    fireEvent.click(screen.getByText("select-food"));
    expect(screen.getByText("portion-marker")).toBeTruthy();
    fireEvent.click(screen.getByText("portion-back"));
    expect(input().value).toBe("arroz");
    expect(screen.getByText(`${tab}-marker`)).toBeTruthy();
    expect(mockSearch).toHaveBeenCalledWith("arroz");
  });

  it("S8 confirming a portion makes the next search visit start empty", () => {
    renderSearch("?meal=lunch&q=arroz");
    fireEvent.click(screen.getByText("select-food"));
    fireEvent.click(screen.getByText("portion-confirm"));
    expect(screen.getByText("home-marker")).toBeTruthy();
    fireEvent.click(screen.getByText("open-search"));
    expect(input().value).toBe("");
    expect(params().get("q")).toBeNull();
    expect(screen.getByText("database-marker")).toBeTruthy();
  });

  it("S9 entering from the bottom tab bar starts empty", () => {
    renderSearch("?meal=lunch&q=arroz&tab=favorites");
    mockClear.mockClear();
    fireEvent.click(screen.getByText("tab-bar-search"));
    expect(input().value).toBe("");
    expect(params().get("q")).toBeNull();
    expect(screen.getByText("database-marker")).toBeTruthy();
    expect(mockClear).toHaveBeenCalled();
  });

  it("S9b tab bar click inside the debounce window resets input and cancels the pending write", () => {
    renderSearch();
    type("pollo");
    mockClear.mockClear();
    fireEvent.click(screen.getByText("tab-bar-search"));
    tick();
    expect(input().value).toBe("");
    expect(params().get("q")).toBeNull();
    expect(mockClear).toHaveBeenCalled();
    expect(mockSearch).not.toHaveBeenCalledWith("pollo");
  });

  it("I1 typing after a tick is not reverted by the resync effect", () => {
    renderSearch();
    type("arroz");
    tick();
    type("arroz con");
    expect(input().value).toBe("arroz con");
    tick();
    expect(input().value).toBe("arroz con");
    expect(params().get("q")).toBe("arroz con");
    type("arroz con p");
    expect(input().value).toBe("arroz con p");
  });

  it("W1 a tab click inside the debounce window does not lose q", () => {
    renderSearch();
    type("arroz");
    fireEvent.click(screen.getByText("Favoritos"));
    tick();
    expect(params().get("q")).toBe("arroz");
    expect(params().get("tab")).toBe("favorites");
    expect(params().get("meal")).toBe("lunch");
  });

  it("T10 a tab click writes tab and keeps meal and q", () => {
    renderSearch("?meal=lunch&q=arroz");
    fireEvent.click(screen.getByText("Creados"));
    expect(params().get("tab")).toBe("created");
    expect(params().get("meal")).toBe("lunch");
    expect(params().get("q")).toBe("arroz");
    expect(screen.getByText("created-marker")).toBeTruthy();
  });
});
