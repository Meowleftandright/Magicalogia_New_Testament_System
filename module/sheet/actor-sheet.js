/**
 * Extend the basic ActorSheet — Magicalogia v0.2.0 spreadsheet port.
 * @extends {ActorSheet}
 */

const DOMAIN_NAMES = ["星", "獸", "力", "歌", "夢", "闇"];
const DEFAULT_IMG_RX = /(mystery-man|icons\/svg\/mystery-man\.svg|^$)/i;

// v12+ namespaced mergeObject; fall back to global for v11.
const mlgMergeObject = (typeof foundry !== "undefined" && foundry?.utils?.mergeObject) || mergeObject;
const mlgDuplicate = (typeof foundry !== "undefined" && foundry?.utils?.duplicate) || duplicate;

export class MagicalogiaActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mlgMergeObject(super.defaultOptions, {
      classes: ["magicalogia", "sheet", "actor"],
      width: 1100,
      height: 900,
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }],
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  /** @override */
  get template() {
    const path = "systems/magicalogia-new-testament/templates/actor";
    return `${path}/${this.actor.type}-sheet.html`;
  }

  /** @override */
  async getData(options) {
    let isOwner = false;
    let isEditable = this.isEditable;
    let data = super.getData(options);
    let actorData = {};

    isOwner = this.document.isOwner;
    isEditable = this.isEditable;

    data.lang = game.i18n.lang;
    data.userId = game.user.id;
    data.isGM = game.user.isGM;

    actorData = this.actor.toObject(false);
    data.actor = actorData;
    data.system = this.actor.system;
    data.system.isOwner = isOwner;

    data.items = Array.from(this.actor.items.values());
    data.items = data.items.map(i => { i.system.id = i.id; return i; });
    data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));

    let subTitle = { state: false, id: "" };
    if ("subTitle" in data.system.talent && data.system.talent.subTitle.state) {
      subTitle.id = data.system.talent.subTitle.id;
      subTitle.state = true;
    }

    data.system.tables = [];
    for (let i = 2; i <= 12; ++i) {
      data.system.tables.push({ line: [], number: i });
      for (let j = 0; j < 6; ++j) {
        const name = String.fromCharCode(65 + j);
        const _cell = data.system.talent.table[j][i - 2];
        data.system.tables[i - 2].line.push({
          id: `col-${j}-${i - 2}`,
          title: `MAGICALOGIA.${name}${i}`,
          name: `system.talent.table.${j}.${i - 2}`,
          state: _cell.state,
          num: _cell.num,
          // v0.2.5 fix: pass displayNum (with −1 domain-curse penalty) to the template.
          // Fallback to raw num if prepareData didn't run yet.
          displayNum: (_cell.displayNum !== undefined && _cell.displayNum !== null && _cell.displayNum !== "")
            ? _cell.displayNum
            : _cell.num,
          misfortune: _cell.misfortune,
          debuf: _cell.debuf,
          penalty: !!_cell.penalty,
          subTitle: (`col-${j}-${i - 2}` == subTitle.id) ? true : false
        });
      }
    }

    actorData.abilityList = [];
    actorData.bondList = [];
    actorData.itemList = [];
    actorData.handoutList = [];

    for (let i of data.items) {
      if (i.type === 'ability') actorData.abilityList.push(i);
      else if (i.type == 'bond') actorData.bondList.push(i);
      else if (i.type == 'item') actorData.itemList.push(i);
      else if (i.type == 'handout') actorData.handoutList.push(i);
    }

    // v0.2.3: count used 咒句 (word_check) for header badge
    data.wordUsedCount = actorData.abilityList.filter(a => a.system.word_check).length;

    data.enrichedBiography = await TextEditor.enrichHTML(data.system.details.biography || "", { async: true });
    data.enrichedTrueLook = await TextEditor.enrichHTML(data.system.true_look.biography || "", { async: true });

    // ── v0.2.0 spreadsheet-port derived data ──
    const det = data.system.details;
    const school = det.school || "大法典";
    const isHeretic = (school !== "大法典" && school !== "");
    data.isHeretic = isHeretic;
    data.isHeretic2 = isHeretic && det.keireki === "異端者";

    const tier = Number(det.tier) || 3;
    const cap = tier + 1;
    data.capLimit = cap;
    data.attackOver = Number(det.attack) > cap;
    data.defenceOver = Number(det.defence) > cap;
    data.rootForceOver = Number(det.root_force) > cap;
    data.showCapWarning = data.attackOver || data.defenceOver || data.rootForceOver;

    data.manaSum = (Number(data.system.mana.value) || 0) + (Number(data.system.tmp_mana.value) || 0);

    const lockCur = Number(data.system.true_look.lock_cur ?? 1);
    data.trueFormAvail = lockCur > 0;

    // Misfortune summary
    const misList = [];
    for (let j = 0; j < 6; ++j) {
      for (let r = 0; r < 11; ++r) {
        if (data.system.talent.table[j][r] && data.system.talent.table[j][r].misfortune) {
          const name = String.fromCharCode(65 + j);
          const key = `MAGICALOGIA.${name}${r + 2}`;
          const localized = game.settings.get("magicalogia-new-testament", key) || game.i18n.localize(key);
          misList.push(localized);
        }
      }
    }
    if (data.system.talent.spirit_talent?.misfortune) misList.push(game.i18n.localize("MAGICALOGIA.SpiritTalent"));
    data.hasMisfortune = misList.length > 0;
    data.misfortuneSummary = misList.length ? misList.join("、") : "無";

    data.isDefaultImg = DEFAULT_IMG_RX.test(this.actor.img || "");

    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Apply current view filter
    this._applyView(html);

    html.find('.item-label').click(this._showItemDetails.bind(this));
    html.find(".echo-item").click(this._echoItemDescription.bind(this));

    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents("[data-item-id]").first();
      const item = this.actor.items.get(li.data("itemId"));
      if (item) item.sheet.render(true);
    });

    if (!this.options.editable) return;

    html.find(".talent-name").on('mousedown', this._onRouteTalent.bind(this));

    html.find('.item-create').click(this._onItemCreate.bind(this));

    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents("[data-item-id]").first();
      const item = this.actor.items.get(li.data("itemId"));
      if (item) item.delete();
    });

    // v0.2.1: inline bond editing for 設定 / 義務 / 屬性 / 命運值 / 墮落
    html.find('.bond-inline').on('change', async (ev) => {
      const tr = $(ev.currentTarget).parents("[data-item-id]").first();
      const item = this.actor.items.get(tr.data("itemId"));
      if (!item) return;
      const field = ev.currentTarget.dataset.bondField;
      let val = ev.currentTarget.value;
      if (ev.currentTarget.type === 'number') val = Number(val) || 0;
      // render: false prevents full-sheet re-render storm (only this row's number changed).
      await item.update({ [`system.${field}`]: val }, { render: false });
    });

    // v0.2.1: bond destiny checkbox — toggle "check" flag
    html.find('.bond-check').on('change', async (ev) => {
      const tr = $(ev.currentTarget).parents("[data-item-id]").first();
      const item = this.actor.items.get(tr.data("itemId"));
      if (!item) return;
      await item.update({ "system.check": ev.currentTarget.checked });
    });

    // v0.2.3: ability/spell row controls
    html.find('.charge-change').on('click', this._onChargeChange.bind(this));
    html.find('.spell-use').on('change', this._onSpellUse.bind(this));
    html.find('.roll-spirit-btn').on('click', this._onRollSpirit.bind(this));

    html.find('.circle').click(this._attackPlot.bind(this));

    html.find('.status-btn').click(this._changeStatus.bind(this));
    html.find('.truelook-change, .tf-toggle').click(this._useTrueForm.bind(this));
    html.find('.mana-change').click(this._changeManaGauge.bind(this));
    // v0.2.7: .charge-change is already bound to _onChargeChange above (line 195).
    // Do NOT re-bind to _changeItemCharge or every click fires twice (= laggy).
    html.find('.use-word').click(this._useItemWord.bind(this));
    html.find('.use-power').click(this._useItemPower.bind(this));

    // ── v0.2.0 spreadsheet-port listeners ──
    html.find('.view-btn').click(this._onViewToggle.bind(this));
    html.find('.section-header').click(this._toggleSection.bind(this));

    html.find('.json-export-btn').click(this._exportJSON.bind(this));
    html.find('.json-import-btn').click(this._importJSON.bind(this));

    html.find('.portrait-box.token-uploader').click(this._openTokenPicker.bind(this));
    html.find('.clear-token').click(this._clearToken.bind(this));
    this._wireTokenDrop(html);

    html.find('.roll-misfortune-btn').click(this._rollMisfortune.bind(this));
    html.find('.clear-misfortune-btn').click(this._clearMisfortune.bind(this));

    html.find('.school-input').change(this._onSchoolChange.bind(this));
    html.find('.keireki-select').change(this._onKeirekiChange.bind(this));

    // Hero-header character name — NOT a form-submitted input (no name=),
    // so it cannot collide with anything; explicit change handler updates actor.name.
    html.find('input[data-edit-name="true"]').on('change', this._onEditName.bind(this));

    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  /** @override */
  setPosition(options = {}) {
    return super.setPosition(options);
  }

  /* ────────────────────────────────────────────────────────
     v0.2.0 perf: debounce sheet re-renders to avoid lag
     when many inputs change in quick succession. Foundry's
     submitOnChange normally re-renders the whole 600+ line
     template on every key/change event — that is what makes
     the sheet feel sluggish. We coalesce them.
  ──────────────────────────────────────────────────────── */
  async _render(force, options) {
    // Preserve view state across re-renders.
    const view = this._currentView;
    const collapsed = [];
    if (this.element && this.element.length) {
      this.element.find('.section.collapsed').each((i, el) => {
        const k = el.getAttribute('data-section');
        if (k) collapsed.push(k);
      });
    }
    const result = await super._render(force, options);
    if (view) this._currentView = view;
    // Re-apply view & collapsed state on the freshly-rendered DOM.
    if (this.element && this.element.length) {
      this._applyView(this.element);
      for (const k of collapsed) {
        this.element.find(`.section[data-section="${k}"]`).addClass('collapsed');
      }
    }
    return result;
  }

  /**
   * Override to debounce submit-on-change. Stock Foundry fires on every
   * 'change' event; for spreadsheet-style sheets with hundreds of inputs
   * this triggers a full re-render storm. We coalesce ~250ms.
   */
  _onChangeInput(event) {
    // For checkbox / select we still want instant feedback.
    const tag = event.currentTarget?.tagName;
    const type = event.currentTarget?.type;
    if (tag === 'SELECT' || type === 'checkbox' || type === 'radio') {
      return super._onChangeInput(event);
    }
    if (this._submitDebounceTimer) clearTimeout(this._submitDebounceTimer);
    this._submitDebounceTimer = setTimeout(() => {
      this._submitDebounceTimer = null;
      super._onChangeInput(event);
    }, 750);
  }

  async _onEditName(event) {
    event.preventDefault();
    const v = String(event.currentTarget.value || "").trim();
    if (!v || v === this.actor.name) return;
    await this.actor.update({ name: v });
  }

  /** Charge 充填 +/-, clamp 0..根源力 */
  async _onChargeChange(event) {
    event.preventDefault();
    const tr = $(event.currentTarget).parents("[data-item-id]").first();
    const item = this.actor.items.get(tr.data("itemId"));
    if (!item) return;
    const add = Number(event.currentTarget.dataset.add) || 0;
    const cap = Number(this.actor.system.details?.root) || 0;
    const cur = Number(item.system.charge) || 0;
    let next = cur + add;
    if (next < 0) next = 0;
    if (cap > 0 && next > cap) {
      ui.notifications?.warn(`充填上限 ${cap} （根源力）`);
      next = cap;
    }
    if (next === cur) return;
    await item.update({ "system.charge": next }, { render: false });
    // Update only the number span in-place to avoid re-render lag.
    tr.find(".charge-change").parent().find("span").text(String(next));
  }

  /** 咒句 (word) checkbox: enforce max 3 used */
  async _onSpellUse(event) {
    const cb = event.currentTarget;
    const tr = $(cb).parents("[data-item-id]").first();
    const item = this.actor.items.get(tr.data("itemId"));
    if (!item) return;

    if (cb.checked) {
      const usedCount = this.actor.items.filter(i => i.type === "ability" && i.system.word_check && i.id !== item.id).length;
      if (usedCount >= 3) {
        cb.checked = false;
        ui.notifications?.warn("咒句已使用 3 次上限");
        return;
      }
    }
    await item.update({ "system.word_check": cb.checked }, { render: false });
  }

  /** Roll 魂之特技: target 6, cost 1 mana (tmp first, then mana) */
  async _onRollSpirit(event) {
    event.preventDefault();
    const sys = this.actor.system;
    const spirit = sys.talent?.spirit_talent || {};
    if (spirit.misfortune) {
      ui.notifications?.warn("魂之特技被厄運击中，無法使用");
      return;
    }
    const tmp = Number(sys.tmp_mana?.value ?? 0);
    const mana = Number(sys.mana?.value ?? 0);
    if (tmp + mana < 1) {
      ui.notifications?.warn("魔力不足（1 點）");
      return;
    }
    // Deduct 1: tmp first, then real mana.
    // v0.2.7 fix: omit render:false so the sheet updates the mana display.
    const update = {};
    if (tmp > 0) update["system.tmp_mana.value"] = tmp - 1;
    else update["system.mana.value"] = mana - 1;
    const beforeT = tmp, beforeM = mana;
    await this.actor.update(update);
    // Verify the write took effect:
    const aT = Number(this.actor.system.tmp_mana?.value ?? 0);
    const aM = Number(this.actor.system.mana?.value ?? 0);
    if (aT === beforeT && aM === beforeM) {
      ui.notifications?.error("扣魔力失敗、請检查 console");
      console.error("_onRollSpirit: update silently failed", { before: {tmp, mana}, after: {aT, aM}, update });
    }

    const title = spirit.name?.trim() || game.i18n.localize("MAGICALOGIA.SpiritTalent") || "魂之特技";
    let add = !!game.settings.get("magicalogia-new-testament", "rollAddon");
    if (event.ctrlKey) add = true;
    const secret = !!event.altKey;
    await this.actor.rollTalent(title, 6, add, secret);
  }

  /* ────────────────────────────────────────────────────────
     View toggle (no Foundry tabs needed — pure CSS filter)
  ──────────────────────────────────────────────────────── */
  _applyView(html) {
    const view = this._currentView || "all";
    const container = html.find('.sheet-container').first();
    container.attr('data-view', view);
    html.find('.view-btn').removeClass('active');
    html.find(`.view-btn[data-view-mode="${view}"]`).addClass('active');
  }

  _onViewToggle(event) {
    event.preventDefault();
    const view = event.currentTarget.dataset.viewMode;
    this._currentView = view;
    const html = $(this.element);
    this._applyView(html);
  }

  _toggleSection(event) {
    // Only react to clicks directly on the header, not on its buttons.
    if (event.target.closest('button, a, input, select')) return;
    const sec = event.currentTarget.closest('.section');
    if (sec) sec.classList.toggle('collapsed');
  }

  /* ────────────────────────────────────────────────────────
     Talent click routing (kept from legacy)
  ──────────────────────────────────────────────────────── */
  async _onRouteTalent(event) {
    if (event.button == 2 || event.which == 3) this._setMisfortuneTalent(event);
    else this._onRollTalent(event);
  }

  async _setMisfortuneTalent(event) {
    event.preventDefault();
    let dataset = event.currentTarget.dataset;
    let id = dataset.id;
    if (id == "-" || !id) return;
    if (id == "spirit") {
      let misfortune = this.actor.system.talent.spirit_talent.misfortune;
      await this.actor.update({ "system.talent.spirit_talent.misfortune": !misfortune });
      return;
    }
    let table = mlgDuplicate(this.actor.system.talent.table);
    let splitId = id.split("-");
    table[splitId[1]][splitId[2]].misfortune = !table[splitId[1]][splitId[2]].misfortune;
    await this.actor.update({ "system.talent.table": table });
  }

  async _onRollTalent(event) {
    event.preventDefault();
    let dataset = event.currentTarget.dataset;
    let num = dataset.num;
    let title = dataset.title;
    let add = true;
    let secret = false;
    let debuf = false;

    if (dataset.debuf == 'true') debuf = true;
    if (!event.ctrlKey && !game.settings.get("magicalogia-new-testament", "rollAddon")) add = false;
    if (event.altKey) secret = true;

    if (event.shiftKey) {
      let subTitle = this.actor.system.talent.subTitle;
      if (subTitle.state) {
        this.actor.update({ "system.talent.subTitle.id": "", "system.talent.subTitle.title": "", "system.talent.subTitle.state": false });
        if (dataset.id != subTitle.id) title = subTitle.title + "->" + title;
        else return;
      } else {
        this.actor.update({ "system.talent.subTitle.id": dataset.id, "system.talent.subTitle.title": title, "system.talent.subTitle.state": true });
        return;
      }
    }
    await this.actor.rollTalent(title, num, add, secret, debuf);
  }

  /* ────────────────────────────────────────────────────────
     Item create / drop (kept from legacy)
  ──────────────────────────────────────────────────────── */
  async _onDropActor(event, data) {
    if (!this.actor.isOwner) return false;
    const actor = await Actor.implementation.fromDropData(data);
    const itemData = {
      name: actor.name,
      img: actor.img,
      type: "bond",
      system: { actor: actor.id }
    };
    if (this.actor.uuid === actor.parent?.uuid) return this._onSortItem(event, itemData);
    return this._onDropItemCreate(itemData);
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const name = `New ${type.capitalize()}`;
    let itemData = {
      name: name,
      type: type,
      img: `icons/svg/${header.dataset.img}.svg`,
      system: {}
    };
    if (type == "handout") itemData.system.visible = { [game.user.id]: true };
    await this.actor.createEmbeddedDocuments('Item', [itemData], {});
  }

  _showItemDetails(event) {
    event.preventDefault();
    const toggler = $(event.currentTarget);
    const item = toggler.parents('.item').first();
    const description = item.find('.item-description').first();
    toggler.toggleClass('open');
    if (description.length) description.slideToggle();
  }

  _echoItemDescription(event) {
    event.preventDefault();
    const li = $(event.currentTarget).parents('[data-item-id]').first();
    if (li.length) this.actor._echoItemDescription(li[0].dataset.itemId);
  }

  async _changeStatus(event) {
    event.preventDefault();
    const name = event.currentTarget.dataset.name;
    const splitName = name.split(".");
    const state = this.actor.system.status[splitName[2]];
    await this.actor.update({ [name]: !state });
  }

  /* ────────────────────────────────────────────────────────
     True Form usage — decrements lock_cur and posts chat
  ──────────────────────────────────────────────────────── */
  async _useTrueForm(event) {
    event.preventDefault();
    const tl = this.actor.system.true_look;
    const lockCur = Number(tl.lock_cur ?? 1);
    const lockMax = Number(tl.lock_max ?? 1);

    if (lockCur <= 0) {
      ui.notifications?.warn?.(game.i18n.localize("MAGICALOGIA.TrueFormDepleted"));
      return;
    }

    const newCur = lockCur - 1;
    const newCheck = !tl.check;
    await this.actor.update({
      "system.true_look.lock_cur": newCur,
      "system.true_look.check": newCheck
    });

    let title = `<img src="${tl.img}" width="28" height="28">&nbsp;&nbsp;<b>${this.actor.name}</b>`;
    let description = `
      <table style="text-align:center;">
        <tr><th>${game.i18n.localize("Name")}</th><th>${game.i18n.localize("MAGICALOGIA.Effect")}</th><th>${game.i18n.localize("MAGICALOGIA.TrueFormUsage")}</th></tr>
        <tr><td>${tl.name || ""}</td><td>${tl.effect || ""}</td><td>${newCur}/${lockMax}</td></tr>
      </table>${tl.biography || ""}`;
    ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div data-actor-id="${this.actor.id}"><h2 style="display:flex;padding-bottom:2px;">${title}</h2>${description}</div>`
    });

    if (game.scenes?.current?.tokens) {
      for (let token of game.scenes.current.tokens) {
        if (token.actor != null && token.actor.id == this.actor.id) {
          if (newCheck && tl.name) token.update({ name: tl.name, img: tl.img });
          else token.update({ name: this.actor.name, img: this.actor.img });
        }
      }
    }
  }

  async _changeManaGauge(event) {
    event.preventDefault();
    const name = event.currentTarget.dataset.name;
    const label = event.currentTarget.dataset.label;
    const add = Number(event.currentTarget.dataset.add);
    let num = 0;
    const splitName = name.split(".");
    if (splitName.length == 2) num = Number(this.actor.system[splitName[1]]);
    else num = Number(this.actor.system[splitName[1]][splitName[2]]);
    if (num + add < 0) return;
    await this.actor.update({ [name]: num + add });
    ChatMessage.create({
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<h3><b>${this.actor.name}</b></h3>${label}: ${num} -> ${num + add}`
    });
  }

  async _changeItemCharge(event) {
    event.preventDefault();
    const chargeButton = $(event.currentTarget);
    const itemEl = chargeButton.parents('[data-item-id]').first();
    const item = this.actor.items.get(itemEl[0].dataset.itemId);
    if (!item) return;
    const add = Number(event.currentTarget.dataset.add);
    const num = Number(item.system.charge);
    if (num + add < 0) return;
    await item.update({ "system.charge": num + add });
    ChatMessage.create({
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<h3><b>${item.name}</b></h3>${num} -> ${num + add}`
    });
  }

  async _useItemWord(event) {
    event.preventDefault();
    const target = $(event.currentTarget);
    const itemEl = target.parents('[data-item-id]').first();
    const item = this.actor.items.get(itemEl[0].dataset.itemId);
    if (!item) return;
    if (item.system.word_check) {
      new Dialog({ title: "Can not use!", content: "<p>You already used this word!</p>", buttons: {} }).render(true);
      return;
    }
    await item.update({ "system.word_check": true });
    ChatMessage.create({
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<h3><b>${item.name}</b></h3><b>${item.system.word || ""}</b>`
    });
  }

  async _useItemPower(event) {
    event.preventDefault();
    const target = $(event.currentTarget);
    const itemEl = target.parents('[data-item-id]').first();
    const item = this.actor.items.get(itemEl[0].dataset.itemId);
    if (!item) return;
    if (item.system.check) {
      const title = game.i18n.localize("MAGICALOGIA.CannotUse");
      const body = game.i18n.localize("MAGICALOGIA.WordAlreadyUsed");
      new Dialog({
        title,
        content: `<p>${body}</p>`,
        buttons: { ok: { label: game.i18n.localize("MAGICALOGIA.OK") || "OK" } },
        default: "ok"
      }).render(true);
      return;
    }
    await item.update({ "system.check": true });
    ChatMessage.create({
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<h3><b>${game.i18n.localize("MAGICALOGIA.DestinyPower")}: ${item.name}</b></h3>`
    });
  }

  async _attackPlot(event) {
    let attackTarget = () => {
      let target = game.user.targets.first();
      if (!target) return;
      let key = [this.actor.id, target.actor.id].sort().join("-");
      let scene = game.scenes.current;
      let magicZone = {};
      if ("magicalogia-new-testament" in scene.flags && "magicZone" in scene.flags["magicalogia-new-testament"])
        magicZone = scene.flags["magicalogia-new-testament"].magicZone;
      if (!(key in magicZone)) {
        Dialog.prompt({
          title: game.i18n.localize("MAGICALOGIA.NotStopBattle"),
          content: `<h2>${game.i18n.localize("MAGICALOGIA.NotStopBattle")}</h2>`,
          callback: () => console.log("Cancel")
        });
        return;
      }
      let data = [];
      data.push({
        actorId: this.actor.id,
        name: this.actor.name,
        dice: Array.from({ length: this.actor.system.details.attack }, () => "?"),
        role: game.i18n.localize("MAGICALOGIA.Attacker")
      });
      let targetActor = target.actor;
      data.push({
        actorId: targetActor.id,
        name: targetActor.name,
        dice: Array.from({ length: targetActor.system.details.defence }, () => "?"),
        role: game.i18n.localize("MAGICALOGIA.Defenser")
      });
      let observers = magicZone[key][targetActor.id] || [];
      for (let observer of observers) {
        let actor = game.actors.get(observer);
        data.push({ actorId: actor.id, name: actor.name, dice: ["?"], role: game.i18n.localize("MAGICALOGIA.Observer") });
      }
      Hooks.call("initPlot", data);
      Hooks.call("spreadPlot");
    };

    Dialog.prompt({
      title: game.i18n.localize("MAGICALOGIA.SelectTarget"),
      content: `<h2>${game.i18n.localize("MAGICALOGIA.SelectTarget")}</h2>`,
      callback: () => attackTarget()
    });
  }

  /* ────────────────────────────────────────────────────────
     v0.2.0 — Token uploader, JSON I/O, Misfortune roll,
     School theme reactor
  ──────────────────────────────────────────────────────── */
  async _openTokenPicker(event) {
    if (event.target.closest('.clear-token')) return;
    if (event.target.closest('img.token-img')) {/* still open picker */}
    event.preventDefault();
    const current = this.actor.img || "icons/svg/mystery-man.svg";
    const fp = new FilePicker({
      type: "image",
      current: current,
      callback: async (path) => {
        await this.actor.update({ img: path });
        // also update prototype token texture
        try {
          await this.actor.update({ "prototypeToken.texture.src": path });
        } catch (e) { /* older v11 path: token.img */
          try { await this.actor.update({ "token.img": path }); } catch (e2) {}
        }
      }
    });
    return fp.browse();
  }

  async _clearToken(event) {
    event.preventDefault();
    event.stopPropagation();
    await this.actor.update({ img: "icons/svg/mystery-man.svg" });
  }

  _wireTokenDrop(html) {
    const box = html.find('.portrait-box.token-uploader')[0];
    if (!box) return;
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    box.addEventListener('dragover', (e) => { stop(e); box.classList.add('dragover'); });
    box.addEventListener('dragleave', (e) => { stop(e); box.classList.remove('dragover'); });
    box.addEventListener('drop', async (e) => {
      stop(e);
      box.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.type?.startsWith('image/')) return;
      try {
        const userId = game.user.id;
        const uploadPath = `worlds/${game.world.id}/tokens`;
        try { await FilePicker.createDirectory("data", uploadPath); } catch (err) { /* exists */ }
        const result = await FilePicker.upload("data", uploadPath, file, {}, { notify: false });
        if (result?.path) {
          await this.actor.update({ img: result.path });
          try { await this.actor.update({ "prototypeToken.texture.src": result.path }); } catch (err2) {}
        }
      } catch (err) {
        console.error("Token upload failed", err);
        ui.notifications?.error?.("Token upload failed: " + err.message);
      }
    });
  }

  async _exportJSON(event) {
    event.preventDefault();
    const payload = {
      schemaVersion: "0.2.0",
      exportedAt: new Date().toISOString(),
      actor: this.actor.toObject(),
      items: this.actor.items.map(i => i.toObject())
    };
    const json = JSON.stringify(payload, null, 2);
    const filename = `magicalogia-${this.actor.name || "actor"}-${Date.now()}.json`;
    saveDataToFile(json, "application/json", filename);
    ui.notifications?.info?.(`Exported ${filename}`);
  }

  async _importJSON(event) {
    event.preventDefault();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      let data;
      try { data = JSON.parse(text); }
      catch (err) { ui.notifications?.error?.("Invalid JSON: " + err.message); return; }

      const confirmed = await Dialog.confirm({
        title: game.i18n.localize("MAGICALOGIA.ImportJSON"),
        content: `<p>${game.i18n.localize("MAGICALOGIA.ImportConfirm")}</p>`
      });
      if (!confirmed) return;

      try {
        const actorData = data.actor || data;
        const itemsData = data.items || actorData.items || [];
        const updateData = { ...actorData };
        delete updateData._id;
        delete updateData.items;
        await this.actor.update(updateData, { diff: false, recursive: false });

        const existingIds = this.actor.items.map(i => i.id);
        if (existingIds.length) await this.actor.deleteEmbeddedDocuments("Item", existingIds);
        if (itemsData.length) {
          const cleaned = itemsData.map(i => { const c = { ...i }; delete c._id; return c; });
          await this.actor.createEmbeddedDocuments("Item", cleaned);
        }
        ui.notifications?.info?.("Import successful");
        this.render(true);
      } catch (err) {
        console.error("Import failed", err);
        ui.notifications?.error?.("Import failed: " + err.message);
      }
    };
    input.click();
  }

  async _rollMisfortune(event) {
    event.preventDefault();
    const d6 = Math.floor(Math.random() * 6) + 1;
    const d2a = Math.floor(Math.random() * 6) + 1;
    const d2b = Math.floor(Math.random() * 6) + 1;
    const dice2 = d2a + d2b;
    const col = d6 - 1;
    const row = dice2 - 2;

    // Clear all previous misfortunes (non-stackable per design)
    const table = mlgDuplicate(this.actor.system.talent.table);
    for (let j = 0; j < 6; ++j)
      for (let r = 0; r < 11; ++r)
        table[j][r].misfortune = false;
    table[col][row].misfortune = true;

    await this.actor.update({
      "system.talent.table": table,
      "system.status.misfortune": true
    });

    const name = String.fromCharCode(65 + col);
    const key = `MAGICALOGIA.${name}${dice2}`;
    const talentName = game.settings.get("magicalogia-new-testament", key) || game.i18n.localize(key);
    const domainName = DOMAIN_NAMES[col];

    ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<h3><b>${this.actor.name} — ${game.i18n.localize("MAGICALOGIA.RollMisfortune")}</b></h3>
        <p>1D6 = <b>${d6}</b>（${domainName}領域）<br>
        2D6 = ${d2a} + ${d2b} = <b>${dice2}</b><br>
        → 「<b>${talentName}</b>」被標記為厄運。</p>
        <p style="font-size:11px;color:#888;">厄運不可疊加，重骰會取代之前的厄運。</p>`
    });
  }

  async _clearMisfortune(event) {
    event.preventDefault();
    const table = mlgDuplicate(this.actor.system.talent.table);
    for (let j = 0; j < 6; ++j)
      for (let r = 0; r < 11; ++r)
        table[j][r].misfortune = false;
    await this.actor.update({
      "system.talent.table": table,
      "system.talent.spirit_talent.misfortune": false,
      "system.status.misfortune": false
    });
  }

  _onSchoolChange(event) {
    // The render after update will recompute isHeretic. Just trigger save normally.
    // No-op placeholder; relies on Foundry form submission.
  }

  _onKeirekiChange(event) {
    // Same — no-op; render recomputes derived flags.
  }
}
