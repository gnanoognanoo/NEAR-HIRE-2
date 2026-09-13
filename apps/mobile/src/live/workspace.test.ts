import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWorkspace, workspaceHome, workspaceTabs, backDestination } from "./workspace.ts";
test("only find/post are workspace preferences; absent or role-like values require choice", () => {
  for (const v of [undefined, null, "", "worker", "admin", {}])
    assert.equal(parseWorkspace(v), null);
  assert.equal(parseWorkspace("find"), "find");
  assert.equal(parseWorkspace("post"), "post");
});
test("direct tabs are independent with shared account destinations", () => {
  assert.deepEqual(workspaceTabs("find"), [
    "jobs",
    "applications",
    "saved",
    "notifications",
    "profile",
  ]);
  assert.deepEqual(workspaceTabs("post"), [
    "workers",
    "posts",
    "applicants",
    "notifications",
    "profile",
  ]);
  assert.equal(workspaceHome("find"), "jobs");
  assert.equal(workspaceHome("post"), "workers");
});
test("back returns to account or current workspace without changing mode", () => {
  for (const w of ["find", "post"] as const) {
    for (const r of ["editProfile", "credits", "settings", "preferences"])
      assert.equal(backDestination(r, w), "profile");
    assert.equal(backDestination(workspaceHome(w), w), null);
    assert.equal(backDestination("notifications", w), workspaceHome(w));
  }
});
