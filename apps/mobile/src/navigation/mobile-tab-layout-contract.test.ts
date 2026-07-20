const { readFileSync } = jest.requireActual("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};
const { join } = jest.requireActual("node:path") as {
  join(...parts: string[]): string;
};

const layoutSource = readFileSync(
  join(process.cwd(), "app", "(tabs)", "_layout.tsx"),
  "utf8"
);

describe("mobile bottom tab layout contract", () => {
  it("keeps exactly five primary destinations with sell in the center", () => {
    const orderedTabs = [
      'name="index"',
      'name="messages"',
      'name="sell"',
      'name="basket"',
      'name="account"'
    ];

    const positions = orderedTabs.map((tab) => layoutSource.indexOf(tab));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));

    const primaryTabSection = layoutSource.slice(positions[0], layoutSource.indexOf('name="favorites"'));
    expect(primaryTabSection.match(/<Tabs\.Screen/g)).toHaveLength(5);
    expect(layoutSource).toContain("function SellTabIcon");
    expect(layoutSource).toContain('title: "Sepetim"');
    expect(layoutSource).toContain('title: "Hesabım"');
  });

  it("hides favorites from the tab bar without removing its route", () => {
    expect(layoutSource).toMatch(
      /name="favorites"[\s\S]*?options=\{\{[\s\S]*?href:\s*null[\s\S]*?title:\s*"Favoriler"/
    );
  });
});
