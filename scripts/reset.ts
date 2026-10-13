import { loadEnv } from "./env";
loadEnv();
import("../lib/store").then(({ reset }) => {
  reset();
  console.log("Sandbox bank reset to demo data.");
});
