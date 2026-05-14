# Changelog

## 0.2.7 — Chat-roll + i18n + lag fixes

### Fixed
- **Chat 「talent」按鈕無法擲骰**：`_echoItemDescription` 把 `<button>` 改成 `<a class="roll-talent">`（Foundry 在 chat 會 strip `<button>`），按鈕現在能正確渲染並觸發擲骰。
- **「Can not use!」/「You already used this power!」硬編碼英文**：改用 i18n key `MAGICALOGIA.CannotUse` / `MAGICALOGIA.WordAlreadyUsed`，正體中文顯示「無法使用 — 此咒句此場景已經使用過了」。
- **魂之特技不扣魔力**：移除 `update` 的 `render: false`（v0.2.4 殘留），現在魔力顯示會即時更新；並加入 before/after 驗證，失敗時 `console.error`。
- **Sheet 仍然 lag**：移除 `.charge-change` 重複綁定（同一 click 同時呼叫 `_onChargeChange` + `_changeItemCharge`），並把 input debounce 從 500ms 提到 750ms。

## 0.2.0 — Spreadsheet Port

Complete visual + functional port of the standalone HTML/CSS/JS spreadsheet character sheet into the Foundry system. Single-page scrollable layout, dual-theme support (大法典 default + 書籍卿/異端 alt), and several new mechanical hooks.

### Added — new schema fields (`template.json`)
- `system.details.school` — 學派 (default `"大法典"`); empty/non-default value triggers the 書籍卿 burgundy/copper theme.
- `system.details.youshiki` — 樣式 free text. Row visible only when school ≠ 大法典.
- `system.details.tier` — 階梯 integer (1–7, default 3). Replaces free-text `details.grade` semantically; `grade` is preserved.
- `system.details.keireki` — 經歷 enum (書警 / 司書 / 書工 / 訪問者 / 異端者 / 外典, default 書警).
- `system.details.izokku` / `system.details.shakui` — 異種族 / 爵位 selects, visible only when keireki = 異端者.
- `system.details.kikan` — 機關 (free text).
- `system.details.conditions` — 條件 (multiline free text).
- `system.true_look.lock_cur` / `lock_max` — 真實之姿 使用次數 (default 1/1).
- `system.talent.hoshiYami` — alias for the existing `overflowX` 星暗相通 toggle (kept in sync via migration; UI still writes `overflowX`).
- `system.schemaVersion` — version marker on the actor document.

All existing fields (`career`, `agency`, `grade`, `attack/defence/root_force`, every status flag, talent.table cells, etc.) are preserved bit-for-bit.

### Added — sheet features
- **VIEW filter bar** (sticky top): 全部 / 真實之姿 / 人物資訊 / 特技+魔力 / 關係 / 藏書. Pure CSS `display:none` rules — no Foundry tab navigation logic. The legacy `tabs:` option is preserved with a hidden `<nav>` for backward compatibility.
- **真實之姿 Hero block** at the top, with name/effect/biography inline editors, lock counter (`lock_cur`/`lock_max`), and a 「使 用」 button that decrements `lock_cur`, posts a chat message, and updates scene tokens (existing token-name swap behavior preserved).
- **Token uploader**: portrait box opens Foundry's native `FilePicker` on click; supports drag-and-drop image upload to `worlds/<world>/tokens/`. Updates `actor.img` and `prototypeToken.texture.src` (with v11 `token.img` fallback). Clear-token button restores `mystery-man.svg`.
- **Profile table** with all new schema fields, school theme reactor, conditional row visibility (異種族 / 爵位 / 樣式 / 經歷 / 機關).
- **Ability cap warning**: when attack / defence / root_force > tier + 1, the offending stat cell turns red with ⚠ and a banner appears above the abilities strip.
- **Talent grid 6 × 11** with column tints (星 / 獸 / 力 / 歌 / 夢 / 闇), gap edge columns + active-gap pattern, `learned` and `misfortune` cell states. The grid is rendered from the existing `system.talent.table` shape — no changes needed to `actor.prepareData` or `_preUpdate`. Left-click rolls (existing behavior), right-click toggles misfortune.
- **骰厄運 (Roll Misfortune) button**: rolls 1D6 for column + 2D6 for row, clears all existing misfortunes (non-stacking), marks the target cell, sets `system.status.misfortune = true`, and posts a chat message. "清除厄運" button clears all misfortunes.
- **魂之特技 (Spirit Talent) panel**: standalone styled panel, name input + roll target. Uses the existing `talent-name` data-attribute path so left-click rolls work as before.
- **變調 (Status) bar**: all 8 status toggles inline, click-to-toggle via existing `status-btn` handler.
- **關係 (Relationships) table**: rendered from `actor.bondList`. Add / edit / delete via existing `item-create` / `item-edit` / `item-delete` pattern.
- **藏書 (Spell Library) table**: rendered from `actor.abilityList`. Charge ± buttons, 咒句 checkbox uses existing `use-word` handler.
- **Global JSON Import / Export buttons** (top-right of VIEW bar): `導出 JSON → Excel` serializes `actor.toObject()` + embedded items to a downloadable JSON file (via `saveDataToFile`); `Excel → 導入 JSON` reads a JSON file, confirms with the user, then overwrites the actor and rebuilds embedded items via `deleteEmbeddedDocuments` + `createEmbeddedDocuments`.
- **書籍卿 alt theme**: when `system.details.school` ≠ "大法典", an outer `.school-other` class swaps the palette to burgundy/copper, hides 經歷/機關 rows, and shows the ⚜ 書籍卿 faction badge.

### Changed
- `system.json` version bumped 0.1.7 → 0.2.0; `templateVersion` 3 → 4; compatibility verified for Foundry 12 (maximum 13).
- `actor-sheet.js`: extended; existing listeners (talent name routing, status toggle, mana change, item charge, item word/power, attack plot, drop actor) preserved. New listeners for view filter, section collapse, JSON I/O, token picker / drop, misfortune roll/clear, true-form usage button.
- `actor-sheet.js`: defaults width 800 → 900, height 780 → 880.
- `actor-sheet.js`: `mergeObject` / `duplicate` calls now route through `foundry.utils.*` namespace when available (v12+), falling back to globals on v11.
- `init.js`: added `Hooks.once("ready") → migrateWorld()`.
- `settings.js`: registered `add` and `mlgConcat` Handlebars helpers.
- `lang/zh-TW.json`: added 學派 / 樣式 / 階梯1–7 / 經歷 (6 variants) / 異種族 / 爵位 / 機關 / 條件 / 骰厄運 / 清除厄運 / 使用真實之姿 / 導出 JSON / 導入 JSON / 星暗相通 / 書籍卿 / 真實之姿剩餘次數 / 視圖切換 (View*) / 區塊標題 (Section*) keys.

### Migration
- New `module/migration.js`. On `Hooks.once("ready")`, iterates `game.actors` and unlocked Actor compendia. For each character actor, fills any missing new field with its default (school=大法典, tier derived from numeric grade or 3, keireki=書警, lock_cur/lock_max=1/1, etc.). Idempotent — gated by world setting `magicalogia.lastMigrationVersion`.

### Breaking-change risk
- None identified. All old field paths still exist and are still read/written by the new template. The new sheet's `data-tab` and tabs option are kept for backward compat, with the `<nav>` hidden.
- `_preUpdate` in `actor.js` still uses `overflowX`; this is unchanged. The new `hoshiYami` field is an alias kept in sync by the migration only.
