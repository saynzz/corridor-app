import { loadEnv } from "./env";
loadEnv();
(async () => {
  const { reset } = await import("../lib/store");
  const { resetCase } = await import("../lib/case/engine");
  const { resetLedger } = await import("../lib/anchor");
  reset();
  resetCase();
  resetLedger();
  console.log("Sandbox bank and tuition case reset to demo data.");
})();
