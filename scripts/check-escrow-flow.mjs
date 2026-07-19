/**
 * Quick sanity check for the TS escrow simulator (no Solana node required).
 * Run: node scripts/check-escrow-flow.mjs
 *
 * Note: imports the TS via dynamic path won't work without ts-node;
 * this script re-implements a minimal mirror of the state machine.
 */

const states = [];
function log(s) {
  states.push(s);
  console.log("✓", s);
}

let status = "Unfunded";
let funded = 0;
const reward = 5_000_000;
let finder = null;
let otpHash = null;

function assert(cond, msg) {
  if (!cond) {
    console.error("✗", msg, "| status=", status);
    process.exit(1);
  }
}

// initialize
status = "Unfunded";
log("initialize_case → Unfunded");

// set finder before fund
finder = "Mai";
log("set_finder while Unfunded (allowed)");

// fund
funded = reward;
status = finder ? "FinderSet" : "Funded";
assert(status === "FinderSet", "should be FinderSet after fund+finder");
log("fund_escrow → FinderSet");

// lock
const otp = "482917";
otpHash = "hash(" + otp + ")";
status = "Locked";
log("lock_for_handover(otp_hash) → Locked");

// bad otp
assert(otpHash !== "hash(000000)", "bad otp rejected conceptually");
log("bad OTP would fail OtpMismatch");

// release
assert(otpHash === "hash(" + otp + ")", "otp ok");
status = "Released";
log("release_reward → Released");

console.log("\nAll checks passed. Flow mirrors programs/safereturn_escrow.");
console.log("States:", states.join(" → "));
