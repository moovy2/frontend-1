import "@material/mwc-button/mwc-button";
import { mdiArrowRight } from "@mdi/js";
import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import { mainWindow } from "../../../homeassistant-frontend/src/common/dom/get_main_window";
import { computeRTL } from "../../../homeassistant-frontend/src/common/util/compute_rtl";
import "../../../homeassistant-frontend/src/components/ha-alert";
import "../../../homeassistant-frontend/src/components/ha-circular-progress";
import "../../../homeassistant-frontend/src/components/ha-expansion-panel";
import "../../../homeassistant-frontend/src/components/ha-svg-icon";
import { showConfirmationDialog } from "../../../homeassistant-frontend/src/dialogs/generic/show-dialog-box";
import { HacsDispatchEvent } from "../../data/common";
import {
  fetchRepositoryInformation,
  repositoryDownloadVersion,
  RepositoryInfo,
} from "../../data/repository";
import { repositoryReleasenotes, websocketSubscription } from "../../data/websocket";
import { scrollBarStyle } from "../../styles/element-styles";
import { HacsStyles } from "../../styles/hacs-common-style";
import { markdown } from "../../tools/markdown/markdown";
import { updateLovelaceResources } from "../../tools/update-lovelace-resources";
import "../hacs-link";
import "./hacs-dialog";
import { HacsDialogBase } from "./hacs-dialog-base";

@customElement("hacs-update-dialog")
export class HacsUpdateDialog extends HacsDialogBase {
  @property() public repository!: string;

  @property({ type: Boolean }) private _updating = false;

  @property() private _error?: any;

  @property({ attribute: false }) private _releaseNotes: {
    name: string;
    body: string;
    tag: string;
  }[] = [];

  @state() private _repository?: RepositoryInfo;

  protected async firstUpdated(changedProps) {
    super.firstUpdated(changedProps);
    this._repository = await fetchRepositoryInformation(this.hass, this.repository);
    if (!this._repository) {
      return;
    }
    if (this._repository.version_or_commit !== "commit") {
      this._releaseNotes = await repositoryReleasenotes(this.hass, String(this._repository.id));
    }
    websocketSubscription(this.hass, (data) => (this._error = data), HacsDispatchEvent.ERROR);
  }

  protected render(): TemplateResult {
    if (!this.active || !this._repository) return html``;

    return html`
      <hacs-dialog
        .active=${this.active}
        .title=${this.hacs.localize("dialog_update.title")}
        .hass=${this.hass}
      >
        <div class=${classMap({ content: true, narrow: this.narrow })}>
          <p class="message">
            ${this.hacs.localize("dialog_update.message", { name: this._repository.name })}
          </p>
          <div class="version-container">
            <div class="version-element">
              <span class="version-number">${this._repository.installed_version}</span>
              <small class="version-text">${this.hacs.localize(
                "dialog_update.downloaded_version"
              )}</small>
            </div>

            <span class="version-separator">
              <ha-svg-icon
                .path=${mdiArrowRight}
              ></ha-svg-icon>
            </span>

            <div class="version-element">
                <span class="version-number">${this._repository.available_version}</span>
                <small class="version-text">${this.hacs.localize(
                  "dialog_update.available_version"
                )}</small>
              </div>
            </div>
          </div>

          ${
            this._releaseNotes.length > 0
              ? this._releaseNotes.map(
                  (release) => html`
                    <ha-expansion-panel
                      .header=${release.name && release.name !== release.tag
                        ? `${release.tag}: ${release.name}`
                        : release.tag}
                      outlined
                      ?expanded=${this._releaseNotes.length === 1}
                    >
                      ${release.body
                        ? markdown.html(release.body, this._repository)
                        : this.hacs.localize("dialog_update.no_info")}
                    </ha-expansion-panel>
                  `
                )
              : ""
          }
          ${
            !this._repository.can_download
              ? html`<ha-alert alert-type="error" .rtl=${computeRTL(this.hass)}>
                  ${this.hacs.localize("confirm.home_assistant_version_not_correct", {
                    haversion: this.hass.config.version,
                    minversion: this._repository.homeassistant,
                  })}
                </ha-alert>`
              : ""
          }
          ${
            this._repository.category === "integration"
              ? html`<p>${this.hacs.localize("dialog_download.restart")}</p>`
              : ""
          }
          ${
            this._error?.message
              ? html`<ha-alert alert-type="error" .rtl=${computeRTL(this.hass)}>
                  ${this._error.message}
                </ha-alert>`
              : ""
          }
        </div>
        <mwc-button
          slot="primaryaction"
          ?disabled=${!this._repository.can_download}
          @click=${this._updateRepository}
          raised
          >
          ${
            this._updating
              ? html`<ha-circular-progress active size="small"></ha-circular-progress>`
              : this.hacs.localize("common.update")
          }
          </mwc-button
        >
        <div class="secondary" slot="secondaryaction">
          <hacs-link .url=${this._getChanglogURL() || ""}>
            <mwc-button>${this.hacs.localize("dialog_update.changelog")}
          </mwc-button>
          </hacs-link>
          <hacs-link .url="https://github.com/${this._repository.full_name}">
            <mwc-button>${this.hacs.localize("common.repository")}
          </mwc-button>
          </hacs-link>
        </div>
      </hacs-dialog>
    `;
  }

  private async _updateRepository(): Promise<void> {
    this._updating = true;

    if (this._repository!.version_or_commit !== "commit") {
      await repositoryDownloadVersion(
        this.hass,
        String(this._repository!.id),
        this._repository!.available_version
      );
    } else {
      await repositoryDownloadVersion(this.hass, String(this._repository!.id));
    }
    if (this._repository!.category === "plugin") {
      if (this.hacs.info.lovelace_mode === "storage") {
        await updateLovelaceResources(
          this.hass,
          this._repository!,
          this._repository!.available_version
        );
      }
    }
    this._updating = false;
    this.dispatchEvent(new Event("hacs-dialog-closed", { bubbles: true, composed: true }));
    if (this._repository!.category === "plugin") {
      showConfirmationDialog(this, {
        title: this.hacs.localize!("common.reload"),
        text: html`${this.hacs.localize!("dialog.reload.description")}<br />${this.hacs.localize!(
            "dialog.reload.confirm"
          )}`,
        dismissText: this.hacs.localize!("common.cancel"),
        confirmText: this.hacs.localize!("common.reload"),
        confirm: () => {
          // eslint-disable-next-line
          mainWindow.location.href = mainWindow.location.href;
        },
      });
    }
  }

  private _getChanglogURL(): string | undefined {
    if (this._repository!.version_or_commit === "commit") {
      return `https://github.com/${this._repository!.full_name}/compare/${
        this._repository!.installed_version
      }...${this._repository!.available_version}`;
    }
    return `https://github.com/${this._repository!.full_name}/releases`;
  }

  static get styles(): CSSResultGroup {
    return [
      scrollBarStyle,
      HacsStyles,
      css`
        .content {
          width: 360px;
          display: contents;
        }
        ha-expansion-panel {
          margin: 8px 0;
        }
        ha-expansion-panel[expanded] {
          padding-bottom: 16px;
        }

        .secondary {
          display: flex;
        }
        .message {
          text-align: center;
          margin: 0;
        }
        .version-container {
          margin: 24px 0 12px 0;
          width: 360px;
          min-width: 100%;
          max-width: 100%;
          display: flex;
          flex-direction: row;
        }
        .version-element {
          display: flex;
          flex-direction: column;
          flex: 1;
          padding: 0 12px;
          text-align: center;
        }
        .version-text {
          color: var(--secondary-text-color);
        }
        .version-number {
          font-size: 1.5rem;
          margin-bottom: 4px;
        }
      `,
    ];
  }
}
