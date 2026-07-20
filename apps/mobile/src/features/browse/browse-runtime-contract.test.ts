const { readFileSync } = jest.requireActual("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};
const { join } = jest.requireActual("node:path") as {
  join(...paths: string[]): string;
};

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("mobile browse runtime contract", () => {
  it("loads every listing in guarded 20-item pages", () => {
    const browse = read("src/features/browse/browse-screen.tsx");
    const api = read("src/features/listings/listings-api.ts");

    expect(browse).toContain("const DISCOVER_PAGE_SIZE = 20");
    expect(browse).toContain("loadMoreInFlightRef.current");
    expect(browse).toContain("nextOffsetRef.current");
    expect(browse).toContain('includeTotal: mode !== "append"');
    expect(browse).toContain("onEndReached={handleLoadMore}");
    expect(api).toContain('query.set("includeTotal", "false")');
    expect(api).toContain("nextOffset: number | null");
  });
});
