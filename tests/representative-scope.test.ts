import { describe, expect, it } from "vitest";
import { getEntitiesForRepresentative } from "../lib/representative-scope";
import type { MedicalEntity, Representative } from "../shared/visit-types";

const entity = (id: string, region: "north" | "south", category: string): MedicalEntity => ({ id, name: id, kind: "عيادة", region, category, createdAt: "2026-01-01T00:00:00.000Z" });
const rep: Representative = { id: "rep-1", name: "مندوب", region: "north", assignedItems: ["قلب"], active: true };

describe("representative scope", () => {
  it("filters by region and assigned category", () => {
    expect(getEntitiesForRepresentative([entity("a", "north", "قلب"), entity("b", "north", "باطنة"), entity("c", "south", "قلب")], rep).map((item) => item.id)).toEqual(["a"]);
  });
  it("treats sanaa as the unrestricted region", () => {
    const allSanaa = { ...rep, region: "sanaa" as const, assignedItems: [] };
    expect(getEntitiesForRepresentative([entity("north", "north", "قلب"), entity("south", "south", "باطنة")], allSanaa).map((item) => item.id)).toEqual(["north", "south"]);
  });
  it("supports explicit entity and shared-location assignments", () => {
    const restricted = { ...rep, region: undefined, assignedItems: [], assignedEntityIds: ["b"], assignedSharedLocationIds: ["loc-1"] };
    const matching = { ...entity("b", "north", "باطنة"), sharedLocationId: "loc-1" };
    const other = { ...entity("c", "north", "باطنة"), sharedLocationId: "loc-2" };
    expect(getEntitiesForRepresentative([matching, other], restricted).map((item) => item.id)).toEqual(["b"]);
  });
});
