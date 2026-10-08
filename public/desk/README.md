# MBL Desk room artwork

Upload **`desk-room-bg.png`** into this directory on the PR branch.

This is the original 1536×1024 PNG supplied for the Desk room (the cozy Φ369 research workspace with the pets and studio equipment), **not** a newly generated alternative.

Expected SHA-256:
```
f35805c8a8bfa1c3d0782bde5e7d250b42a42ab95e80140788044bf2b784c970
```

The UI uses `/MoreBounceLabs/desk/desk-room-bg.png` as its full-bleed background without modifying the image. The CI gate checks its hash, original dimensions, and final Pages output. Do not optimize, crop, or re-encode it.
