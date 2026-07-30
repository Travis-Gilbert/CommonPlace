import { describe, expect, it } from "vitest";
import { isKeySet, showCardinality, visibleKeys } from "./relLabels";

const set = { left: "id", right: "a_id" };
const partial = { left: "id", right: "" };
const unset = { left: "", right: "" };

describe("relationship label projection", () => {
  it("recognizes complete and partial keys", () => {
    expect(isKeySet(set)).toBe(true);
    expect(isKeySet(partial)).toBe(true);
    expect(isKeySet(unset)).toBe(false);
  });

  it("filters keys by the selected pure view mode", () => {
    expect(visibleKeys([set, unset], "all")).toEqual([set, unset]);
    expect(visibleKeys([set, unset], "defined")).toEqual([set]);
    expect(visibleKeys([set, unset], "undefined")).toEqual([unset]);
    expect(visibleKeys([set, unset], "hidden")).toEqual([]);
  });

  it("shows cardinality only when the selected key view has content", () => {
    expect(showCardinality([], "all")).toBe(true);
    expect(showCardinality([set], "defined")).toBe(true);
    expect(showCardinality([unset], "defined")).toBe(false);
    expect(showCardinality([set], "hidden")).toBe(false);
  });
});
