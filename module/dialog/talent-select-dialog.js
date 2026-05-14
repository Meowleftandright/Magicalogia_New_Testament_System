

export class TalentSelectDialog extends Dialog {
    constructor(actor, callback, options = {}) {
        const self = { actor, select: null, callback };

        // Build a list of all (talent-name, num) pairs for random pick.
        const allTalents = [];
        for (let i = 1; i <= 12; ++i)
            for (let j = 0; j < 6; ++j) {
                const code = String.fromCharCode(65 + j);
                const key = (i === 1) ? `${code}1` : `${code}${i}`;
                let title = game.i18n.localize(`MAGICALOGIA.${key}`);
                if (i === 1) title += " " + game.i18n.localize("MAGICALOGIA.Tmp");
                allTalents.push(title);
            }

        super({
            title: "Select Talent",
            content: TalentSelectDialog._buildContent(actor),
            buttons: {
                confirm: {
                    icon: '<i class="fas fa-check"></i>',
                    label: game.i18n.localize("MAGICALOGIA.Confirm") || "Confirm",
                    callback: (html) => {
                        const $sel = html.find(".talent-select").first();
                        if (!$sel.length) {
                            ui.notifications?.warn(game.i18n.localize("MAGICALOGIA.PickFirst") || "請先選擇一個特技");
                            return false;
                        }
                        const name = $sel.text().split("/")[0].trim();
                        callback(name);
                    }
                },
                random: {
                    icon: '<i class="fas fa-dice"></i>',
                    label: game.i18n.localize("MAGICALOGIA.Tmp") || "可變",
                    callback: () => {
                        // True random pick from the full talent grid.
                        const pick = allTalents[Math.floor(Math.random() * allTalents.length)];
                        callback(pick);
                    }
                }
            },
            default: "confirm"
        }, options);

        this.actor = actor;
        this.select = null;
    }

      /** @override */
	static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            template: "templates/hud/dialog.html",
            classes: ["magicalogia", "dialog"],
            width: 600
        });
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        html.find(".select").on("click", this._selectDice.bind(this));
    }

    static _buildContent(actor) {
        const tmpFn = TalentSelectDialog.prototype.getContent;
        return tmpFn.call({ actor });
    }


    getContent() {
        let table = Array.from({length: 12}, () => []);
        if (this.actor != null) {
            for (let j = 0; j < 6; ++j) {
                let name = String.fromCharCode(65 + j);
                table[0].push({
                    title: game.i18n.localize(`MAGICALOGIA.${name}1`) + " " + game.i18n.localize("MAGICALOGIA.Tmp"),
                    num: 0
                });
            }

            for (let i = 2; i <= 12; ++i)
            for (let j = 0; j < 6; ++j) {
                let name = String.fromCharCode(65 + j);
                table[i-1].push({
                    title: game.i18n.localize(`MAGICALOGIA.${name}${i}`),
                    num: this.actor.system.talent.table[j][i - 2].num
                });
            }


        } else {
            for (let j = 0; j < 6; ++j) {
                let name = String.fromCharCode(65 + j);
                table[0].push({
                    title: game.i18n.localize(`MAGICALOGIA.${name}1`) + " " + game.i18n.localize("MAGICALOGIA.Tmp"),
                    num: 0
                });
            }

            for (let i = 2; i <= 12; ++i)
            for (let j = 0; j < 6; ++j) {
                let name = String.fromCharCode(65 + j);
                table[i-1].push({
                    title: game.i18n.localize(`MAGICALOGIA.${name}${i}`),
                    num: 0
                });
            }
        }

        let content = `<table>`;
        content += `<tr>`;
        for (let block of table[0])
            content += `<th class="select">${block.title}</th>`;
        content += `</tr>`;

        for (let i = 1; i < 12; ++i) {
            content += `<tr>`;
            for (let block of table[i]) {
                let text = block.title;
                if (block.num != 0)
                    text += "/" + block.num;

                content += `<td class="select">${text}</td>`;
            }
            content += `</tr>`;
        }
        content += `</table>`;

        return content;
    }

    _selectDice(event) {
        event.preventDefault();
    
        if ($(event.currentTarget).hasClass("talent-select")) {
            $(event.currentTarget).removeClass("talent-select");

            this.select = null;
            return;
        }
    
        $(event.currentTarget).parent().parent().find(".talent-select").removeClass("talent-select");
        $(event.currentTarget).addClass("talent-select");
    
        this.select = event.currentTarget;
    }

}
