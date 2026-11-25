import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import type { AnchorHTMLAttributes } from "react";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  searchParams: vi.fn(() => new URLSearchParams()),
}));

export function setSearchParams(params: URLSearchParams) {
  navigationMocks.searchParams.mockReturnValue(params);
}

vi.mock("next/navigation", () => ({
  useRouter: () => navigationMocks,
  usePathname: () => "/",
  useSearchParams: () => navigationMocks.searchParams(),
  useParams: () => ({ leagueId: "11111111-1111-4111-8111-111111111111" }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    createElement("a", { href, ...props }, children),
}));

beforeEach(() => {
  navigationMocks.push.mockReset();
  navigationMocks.replace.mockReset();
  navigationMocks.refresh.mockReset();
  navigationMocks.searchParams.mockImplementation(() => new URLSearchParams());
});

afterEach(() => {
  cleanup();
});
