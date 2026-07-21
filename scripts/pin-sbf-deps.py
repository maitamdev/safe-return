"""
Pin crates so Solana platform-tools cargo/rustc (1.84) can build findback.
Handles both edition2024 parse failures and MSRV (requires rustc X.Y) errors.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = (
    Path.home()
    / ".local/share/solana/install/releases/2.1.0/solana-release/bin/sdk/sbf/dependencies/platform-tools"
)
CARGO_SBF = TOOLS / "rust/bin/cargo.exe"
HOST_CARGO = "cargo"
LOG = Path(os.environ.get("TEMP", "/tmp")) / "sbf-pin-loop.log"

# name -> candidate older versions (newest-compatible first)
PIN_CANDIDATES: dict[str, list[str]] = {
    "proc-macro-crate": ["3.2.0", "3.1.0", "2.0.2"],
    "blake3": ["1.5.5", "1.5.4", "1.5.1"],
    "indexmap": ["2.7.1", "2.6.0", "2.2.6"],
    "hashbrown": ["0.15.2", "0.14.5", "0.13.2"],
    "zeroize": ["1.8.1", "1.7.0"],
    "zeroize_derive": ["1.4.2", "1.4.1", "1.3.3"],
    "toml_edit": ["0.22.22", "0.22.20"],
    "unicode-segmentation": ["1.12.0", "1.11.0", "1.10.1"],
    "syn": ["2.0.100", "2.0.87"],
    "serde": ["1.0.217", "1.0.210"],
    "serde_json": ["1.0.140", "1.0.128"],
    "cc": ["1.2.10", "1.1.31", "1.0.106"],
    "getrandom": ["0.2.15"],
    "thiserror": ["2.0.11", "1.0.69"],
    "thiserror-impl": ["2.0.11", "1.0.69"],
    "proc-macro2": ["1.0.93", "1.0.89"],
    "quote": ["1.0.38", "1.0.37"],
    "base64": ["0.22.1", "0.21.7"],
    "bytemuck": ["1.21.0", "1.18.0"],
    "num-bigint": ["0.4.6"],
    "itertools": ["0.13.0", "0.12.1"],
}


def run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)


def pin(name: str, version: str) -> bool:
    lock = (ROOT / "Cargo.lock").read_text(encoding="utf-8")
    specs: list[str] = []
    for m in re.finditer(rf'name = "{re.escape(name)}"\nversion = "([^"]+)"', lock):
        specs.append(f"{name}@{m.group(1)}")
    specs.extend([f"{name}@{version}", name])
    seen: set[str] = set()
    for spec in specs:
        if spec in seen:
            continue
        seen.add(spec)
        r = run([HOST_CARGO, "update", "-p", spec, "--precise", version])
        if r.returncode == 0:
            print(f"PIN OK {spec} -> {version}", flush=True)
            return True
        err = (r.stderr or r.stdout or "").strip().splitlines()[-2:]
        print(f"PIN FAIL {spec} -> {version}: {' | '.join(err)}", flush=True)
    return False


def try_build() -> tuple[int, str]:
    env = {k: str(v) for k, v in os.environ.items()}
    env["PATH"] = f"{TOOLS / 'rust/bin'};{TOOLS / 'llvm/bin'};{env.get('PATH', '')}"
    env["CC"] = str(TOOLS / "llvm/bin/clang.exe")
    env["AR"] = str(TOOLS / "llvm/bin/llvm-ar.exe")
    r = subprocess.run(
        [
            str(CARGO_SBF),
            "build",
            "--release",
            "--target",
            "sbf-solana-solana",
            "-p",
            "findback",
            "--manifest-path",
            "programs/findback/Cargo.toml",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        env=env,
    )
    out = (r.stdout or "") + "\n" + (r.stderr or "")
    LOG.write_text(out, encoding="utf-8")
    return r.returncode, out


def extract_offenders(log: str) -> list[tuple[str, str | None]]:
    """Return list of (name, current_version_or_None)."""
    found: list[tuple[str, str | None]] = []
    # edition2024 parse
    m = re.search(r"failed to parse manifest at .*?[\\/]([^\\/]+)[\\/]Cargo\.toml", log)
    if m:
        pkg_dir = m.group(1)
        m2 = re.match(r"^(.+?)-(\d+\.\d+\.\d+.*?)$", pkg_dir)
        if m2:
            found.append((m2.group(1), m2.group(2)))
    # MSRV:  package@ver requires rustc X
    for m in re.finditer(r"^\s*([A-Za-z0-9_-]+)@([0-9][^ \n]+)\s+requires rustc", log, re.M):
        found.append((m.group(1), m.group(2)))
    # cargo update hint
    for m in re.finditer(
        r"cargo update ([A-Za-z0-9_-]+)@([0-9][^ \n]+) --precise",
        log,
    ):
        found.append((m.group(1), m.group(2)))
    # de-dupe preserve order
    seen: set[str] = set()
    out: list[tuple[str, str | None]] = []
    for name, ver in found:
        if name in seen:
            continue
        seen.add(name)
        out.append((name, ver))
    return out


def pin_package(name: str, current: str | None) -> bool:
    cands = list(PIN_CANDIDATES.get(name, []))
    if current:
        # generate slightly older versions heuristically if no candidates
        parts = current.split(".")
        if len(parts) >= 3 and parts[1].isdigit() and parts[2].isdigit():
            major, minor, patch = parts[0], int(parts[1]), int(parts[2])
            for p in range(patch - 1, -1, -1):
                cands.append(f"{major}.{minor}.{p}")
            if minor > 0:
                cands.append(f"{major}.{minor - 1}.0")
    # unique
    seen: set[str] = set()
    uniq: list[str] = []
    for v in cands:
        if v not in seen and v != current:
            seen.add(v)
            uniq.append(v)
    for v in uniq[:12]:
        if pin(name, v):
            return True
    return False


def main() -> int:
    if not CARGO_SBF.exists():
        print("missing platform-tools cargo", CARGO_SBF)
        return 2

    for name, versions in [
        ("proc-macro-crate", "3.2.0"),
        ("blake3", "1.5.5"),
        ("indexmap", "2.7.1"),
        ("zeroize", "1.8.1"),
        ("zeroize_derive", "1.4.2"),
    ]:
        pin(name, versions)

    for attempt in range(60):
        code, log = try_build()
        if code == 0:
            print("BUILD OK", flush=True)
            return 0
        offenders = extract_offenders(log)
        if not offenders:
            print("BUILD FAIL (unknown)", flush=True)
            print("\n".join(log.strip().splitlines()[-40:]), flush=True)
            return 1
        print(f"attempt {attempt}: {offenders}", flush=True)
        progressed = False
        for name, ver in offenders:
            if pin_package(name, ver):
                progressed = True
            else:
                print(f"could not pin {name} (current {ver})", flush=True)
        if not progressed:
            print("no progress", flush=True)
            print("\n".join(log.strip().splitlines()[-40:]), flush=True)
            return 1

    print("too many attempts")
    return 1


if __name__ == "__main__":
    sys.exit(main())
