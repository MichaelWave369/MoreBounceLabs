"""Tests for the Backspin96 archive stage gate, independent of the real ZIP."""
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
import hashlib
import importlib.util
import tempfile
import unittest
import zipfile

script = Path(__file__).with_name("stage-backspin96.py")
spec = importlib.util.spec_from_file_location("stage_backspin96", script)
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)


class StageBackspinTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="backspin-test-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "vendor").mkdir()
        stage.SOURCE = self.root / "vendor" / "backspin96-source.zip"
        stage.DEST = self.root / "public" / "backspin96"
        self.base = "Backspin96_Library_Reliability_Recovery_Phase6A3_v1.5.0"

    def write_archive(self, extra=None):
        payloads = {name: "/* fixture */" for name in stage.REQUIRED}
        payloads["index.html"] = '<link href="./styles.css"><script src="./app.js"></script>'
        payloads["LICENSE"] = "MIT License"
        payloads.update(extra or {})
        with zipfile.ZipFile(stage.SOURCE, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in payloads.items():
                archive.writestr(self.base + "/" + name, data)
        stage.EXPECTED_SHA256 = hashlib.sha256(stage.SOURCE.read_bytes()).hexdigest()

    def test_pending_source_is_honestly_unavailable(self):
        with redirect_stdout(StringIO()) as output:
            self.assertEqual(stage.stage(), 0)
        self.assertIn("PENDING", output.getvalue())
        self.assertFalse(stage.DEST.exists())

    def test_valid_checked_source_stages_real_relative_runtime(self):
        self.write_archive({"audio/mixer-law.js": "export const gain = 1;"})
        self.assertEqual(stage.stage(), 0)
        self.assertTrue((stage.DEST / "audio" / "backspin-processor.js").is_file())
        self.assertTrue((stage.DEST / "audio" / "mixer-law.js").is_file())
        marker = (stage.DEST / "mbl-stage.json").read_text()
        self.assertIn(stage.EXPECTED_SHA256, marker)
        self.assertFalse((stage.DEST / "docs").exists())

    def test_archive_sha_mismatch_blocks_unreviewed_content(self):
        self.write_archive()
        stage.EXPECTED_SHA256 = "0" * 64
        with self.assertRaisesRegex(ValueError, "hash mismatch"):
            stage.stage()
        self.assertFalse(stage.DEST.exists())

    def test_path_traversal_rejected_even_with_valid_archive_digest(self):
        self.write_archive({"../outside.js": "unexpected", "safe.js": "harmless"})
        with self.assertRaisesRegex(ValueError, "Unsafe ZIP filename"):
            stage.stage()
        self.assertFalse((self.root / "outside.js").exists())

    def test_missing_worklet_or_library_cannot_be_marked_ready(self):
        self.write_archive()
        with zipfile.ZipFile(stage.SOURCE, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name in stage.REQUIRED - {"audio/backspin-processor.js"}:
                data = '<script src="./app.js"></script><link href="./styles.css">' if name == "index.html" else "fixture"
                archive.writestr(self.base + "/" + name, data)
        stage.EXPECTED_SHA256 = hashlib.sha256(stage.SOURCE.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError, "missing required runtime files"):
            stage.stage()


if __name__ == "__main__":
    unittest.main()
