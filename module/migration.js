/**
 * v0.2.0 migration: fills new schema defaults on actors created under v0.1.x.
 * Idempotent — safe to re-run.
 */

const TARGET_VERSION = "0.2.0";

function _cmpVer(a, b) {
  const ax = (a || "0").split(".").map(n => parseInt(n, 10) || 0);
  const bx = (b || "0").split(".").map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(ax.length, bx.length); ++i) {
    const av = ax[i] || 0, bv = bx[i] || 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

export async function migrateWorld() {
  if (!game.user.isGM) return;

  const lastRun = game.settings.get("magicalogia-new-testament", "lastMigrationVersion") || "0.0.0";
  if (_cmpVer(lastRun, TARGET_VERSION) >= 0) return;

  ui.notifications?.info?.(`Magicalogia — migrating world to v${TARGET_VERSION}…`);
  console.log(`Magicalogia migration: ${lastRun} → ${TARGET_VERSION}`);

  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    try {
      const update = _buildActorUpdate(actor);
      if (Object.keys(update).length > 0) {
        await actor.update(update, { diff: false });
      }
    } catch (err) {
      console.error(`Magicalogia migration: actor ${actor.name} failed`, err);
    }
  }

  // Compendium actors (unlocked only)
  for (const pack of game.packs) {
    if (pack.documentName !== "Actor" || pack.locked) continue;
    try {
      const docs = await pack.getDocuments();
      for (const actor of docs) {
        if (actor.type !== "character") continue;
        const update = _buildActorUpdate(actor);
        if (Object.keys(update).length > 0) await actor.update(update, { diff: false });
      }
    } catch (err) {
      console.error(`Magicalogia migration: pack ${pack.collection} failed`, err);
    }
  }

  await game.settings.set("magicalogia-new-testament", "lastMigrationVersion", TARGET_VERSION);
  ui.notifications?.info?.(`Magicalogia — migration to v${TARGET_VERSION} complete.`);
}

function _buildActorUpdate(actor) {
  const sys = actor.system || {};
  const det = sys.details || {};
  const tl = sys.true_look || {};
  const tal = sys.talent || {};
  const update = {};

  if (det.school === undefined || det.school === null) {
    update["system.details.school"] = "大法典";
  }
  if (det.youshiki === undefined) update["system.details.youshiki"] = "";

  if (det.tier === undefined || det.tier === null) {
    let tier = 3;
    if (det.grade) {
      const parsed = parseInt(String(det.grade).replace(/[^\d]/g, ""), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 7) tier = parsed;
    }
    update["system.details.tier"] = tier;
  }

  if (det.keireki === undefined || det.keireki === null || det.keireki === "") {
    update["system.details.keireki"] = "書警";
  }
  if (det.izokku === undefined) update["system.details.izokku"] = "";
  if (det.shakui === undefined) update["system.details.shakui"] = "";
  if (det.kikan === undefined) update["system.details.kikan"] = "";
  if (det.conditions === undefined) update["system.details.conditions"] = "";

  if (tl.lock_cur === undefined || tl.lock_cur === null) update["system.true_look.lock_cur"] = 1;
  if (tl.lock_max === undefined || tl.lock_max === null) update["system.true_look.lock_max"] = 1;

  // hoshiYami alias — preserve existing overflowX value
  if (tal.hoshiYami === undefined) {
    update["system.talent.hoshiYami"] = !!tal.overflowX;
  }

  if (sys.schemaVersion !== "0.2.0") update["system.schemaVersion"] = "0.2.0";

  return update;
}

export function registerMigrationSettings() {
  game.settings.register("magicalogia-new-testament", "lastMigrationVersion", {
    scope: "world",
    config: false,
    type: String,
    default: "0.0.0"
  });
}
