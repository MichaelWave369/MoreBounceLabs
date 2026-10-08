#!/usr/bin/env python3
"""Stage the operator-supplied Backspin '96 v1.5.0 archive for static Pages.

This script never fetches or scrapes media and intentionally keeps Backspin's
original audio engine untouched. No remote deployment occurs without the
operator first committing the expected archive to vendor/.
"""
from pathlib import Path, PurePosixPath
import hashlib
import json
import shutil
import stat
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "vendor" / "backspin96-source.zip"
DEST = ROOT / "public" / "backspin96"
EXPECTED_SHA256 = "0653316cf3e6a8f331d56089d6d79916b3543497519a4b3fb1d911d06bb5bd6e"
ALLOW = {"audio", "analysis", "performance", "library", "styles", "visual", "world"}
TOP_FILES = {"index.html", "app.js", "styles.css", "LICENSE"}
REQUIRED = {
    "index.html", "app.js", "styles.css", "LICENSE",
    "audio/backspin-processor.js", "audio/engine.js",
    "analysis/bpm-worker.js", "library/suno-crate-bridge.js",
    "world/world-controller.js", "visual/stress-scene.js",
}

def stage() -> int:
    if not SOURCE.exists():
        if DEST.exists():
            shutil.rmtree(DEST)
        print("BACKSPIN96 PENDING: upload the original v1.5.0 zip to vendor/backspin96-source.zip before publishing the booth.")
        return 0

    digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA256:
        raise ValueError(f"Backspin96 source hash mismatch: {digest}; expected {EXPECTED_SHA256}. Refusing unreviewed source.")

    with tempfile.TemporaryDirectory(prefix="mbl-backspin-") as tempdir:
        tmp = Path(tempdir)
        staged = tmp / "backspin96"
        staged.mkdir()
        found = set()
        total_bytes = 0
        with zipfile.ZipFile(SOURCE) as z:
            entries = [item for item in z.infolist() if not item.is_dir()]
            if len(entries) > 250:
                raise ValueError("Too many archive files.")
            for item in entries:
                path = PurePosixPath(item.filename)
                pieces = path.parts
                if len(pieces) < 2 or not pieces[0].startswith("Backspin96_Library_Reliability_Recovery_Phase6A3_v1.5.0"):
                    raise ValueError("Unexpected Backspin ZIP layout.")
                rel = PurePosixPath(*pieces[1:])
                if not rel.parts or ".." in rel.parts or rel.is_absolute() or "\\" in item.filename:
                    raise ValueError("Unsafe ZIP filename.")
                if stat.S_ISLNK(item.external_attr >> 16):
                    raise ValueError("Symlinks are not allowed.")
                if rel.parts[0] not in ALLOW and str(rel) not in TOP_FILES:
                    continue
                if rel.parts[0] in ALLOW and rel.suffix not in {".js", ".css", ".mjs", ".json"}:
                    raise ValueError(f"Unexpected runtime file type: {rel}")
                if item.file_size > 2_000_000:
                    raise ValueError(f"Oversized entry: {rel}")
                total_bytes += item.file_size
                if total_bytes > 8_000_000:
                    raise ValueError("Oversized runtime payload.")
                target = staged.joinpath(*rel.parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(z.read(item))
                found.add(str(rel))

        missing = REQUIRED - found
        if missing:
            raise ValueError("Backspin archive missing required runtime files: " + ", ".join(sorted(missing)))
        html = (staged / "index.html").read_text(encoding="utf-8")
        if './app.js' not in html or './styles.css' not in html:
            raise ValueError("Backspin HTML must use its project-relative assets.")
        # Copy-only integration: the original pinned ZIP is not modified.
        # The appended adapter is part of the *generated* Pages copy and uses
        # the original engine's module-local variables to expose only status
        # and vetted scratch/release operations to the same-origin MBL parent.
        bridge_source = ROOT / "scripts" / "backspin-overlay-bridge.js"
        if not bridge_source.is_file():
            raise ValueError("Required Backspin poster adapter is missing.")
        app = staged / "app.js"
        source_text = app.read_text(encoding="utf-8")
        # Install immediately after construction of the trusted engine rather
        # than waiting until the end of a potentially slow graphics bootstrap.
        anchor = "const system = new BackspinMixerSystem();"
        if source_text.count(anchor) != 1:
            raise ValueError("Backspin v1.5.0 engine insertion point changed; refusing unsafe adapter patch.")
        app.write_text(source_text.replace(anchor, anchor + "\n" +
                       bridge_source.read_text(encoding="utf-8") + "\n", 1), encoding="utf-8")
        (staged / "mbl-stage.json").write_text(json.dumps({
            "engine": "Backspin96", "sourceVersion": "1.5.0",
            "sourceSHA256": digest, "scope": "local-user-imports-only",
            "host": "MoreBounceLabs GitHub Pages", "overlayBridgeVersion": 1,
        }, indent=2) + "\n", encoding="utf-8")
        if DEST.exists():
            shutil.rmtree(DEST)
        shutil.copytree(staged, DEST)

    print(f"PASS Backspin96 runtime staged: {len(found)} source files under public/backspin96/ ({total_bytes} bytes); source hash verified.")
    return 0

if __name__ == "__main__":
    try:
        sys.exit(stage())
    except (ValueError, OSError, zipfile.BadZipFile, RuntimeError) as exc:
        print("FAIL Backspin96 stage: " + str(exc), file=sys.stderr)
        sys.exit(1)
