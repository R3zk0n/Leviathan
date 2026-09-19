# Release rules

Drop the AppShark rule JSON files you want in the public image here.

This folder is copied into the engine image as `/appshark_engine/appshark/config/rules`.
Nothing from the private working-tree dumps (`first-pass`, `WIP_Rules`, `claude-rules`,
`Fruit_Rules`, `custom_rules`, …) is shipped.

Each file should be a valid AppShark rule object (one top-level rule name).
Duplicate top-level names collide — keep names unique.
