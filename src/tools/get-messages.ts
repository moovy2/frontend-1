import memoizeOne from "memoize-one";
import { Message } from "../data/common";
import { Hacs } from "../data/hacs";
import { RepositoryBase } from "../data/repository";

export const getMessages = memoizeOne((hacs: Hacs, loadedIntegrationMy: boolean): Message[] => {
  const messages: Message[] = [];
  const repositoriesNotAddedToLovelace: RepositoryBase[] = [];
  const repositoriesRestartPending: RepositoryBase[] = [];

  hacs.repositories.forEach((repo) => {
    if (repo.status === "pending-restart") {
      repositoriesRestartPending.push(repo);
    }
    if (!hacs.addedToLovelace!(hacs, repo)) {
      repositoriesNotAddedToLovelace.push(repo);
    }
    if (repo.installed && hacs.removed.map((r) => r.repository)?.includes(repo.full_name)) {
      const removedrepo = hacs.removed.find((r) => r.repository === repo.full_name);
      messages.push({
        name: hacs.localize("entry.messages.removed_repository", {
          repository: removedrepo.repository,
        }),
        info: removedrepo.reason,
        severity: "warning",
        dialog: "remove",
        repository: repo,
      });
    }
  });

  if (hacs.info?.startup && ["setup", "waiting", "startup"].includes(hacs.info.stage)) {
    messages.push({
      name: hacs.localize(`entry.messages.${hacs.info.stage}.title`),
      info: hacs.localize(`entry.messages.${hacs.info.stage}.content`),
      severity: "warning",
    });
  }

  if (hacs.info?.disabled_reason) {
    return [
      {
        name: hacs.localize("entry.messages.disabled.title"),
        secondary: hacs.localize(`entry.messages.disabled.${hacs.info?.disabled_reason}.title`),
        info: hacs.localize(`entry.messages.disabled.${hacs.info?.disabled_reason}.description`),
        severity: "error",
      },
    ];
  }

  if (repositoriesNotAddedToLovelace.length > 0) {
    messages.push({
      name: hacs.localize("entry.messages.resources.title"),
      info: hacs.localize("entry.messages.resources.content", {
        number: repositoriesNotAddedToLovelace.length,
      }),
      severity: "error",
    });
  }

  if (repositoriesRestartPending.length > 0) {
    messages.push({
      name: hacs.localize("entry.messages.restart.title"),
      path: loadedIntegrationMy ? "/_my_redirect/server_controls" : undefined,
      info: hacs.localize("entry.messages.restart.content", {
        number: repositoriesRestartPending.length,
        pluralWording:
          repositoriesRestartPending.length === 1
            ? hacs.localize("common.integration")
            : hacs.localize("common.integration_plural"),
      }),
      severity: "error",
    });
  }

  return messages;
});
