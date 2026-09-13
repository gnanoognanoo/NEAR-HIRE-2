import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { creditBalanceKey } from "./credit-query.ts";
test("chip and wallet observers refresh from the same server balance after publication", async () => {
  const client = new QueryClient();
  let serverBalance = 5;
  const options = { queryKey: creditBalanceKey, queryFn: async () => serverBalance };
  const chip = new QueryObserver(client, options),
    wallet = new QueryObserver(client, options);
  const a = chip.subscribe(() => {}),
    b = wallet.subscribe(() => {});
  try {
    await chip.refetch();
    assert.equal(wallet.getCurrentResult().data, 5);
    serverBalance = 4;
    await client.invalidateQueries();
    assert.equal(chip.getCurrentResult().data, 4);
    assert.equal(wallet.getCurrentResult().data, 4);
  } finally {
    a();
    b();
    client.clear();
  }
});
