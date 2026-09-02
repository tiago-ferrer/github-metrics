// Barrel de registro das actions. Cada arquivo se registra via `streamDeck.actions.registerAction`
// ao ser importado (decorator @action). Preenchido incrementalmente na Fase 2 do STEPS.md.
import streamDeck from "@elgato/streamdeck";
import { PrsOpenAction } from "./prs-open.js";
import { ReviewRequestedAction } from "./review-requested.js";
import { IssuesAssignedAction } from "./issues-assigned.js";
import { NotificationsAction } from "./notifications.js";
import { CommitsAction } from "./commits.js";
import { ReviewsDoneAction } from "./reviews-done.js";
import { StarsReceivedAction } from "./stars-received.js";
import { StatusAction } from "./status.js";
import { OrgPrsOpenAction } from "./org-prs-open.js";

streamDeck.actions.registerAction(new PrsOpenAction());
streamDeck.actions.registerAction(new ReviewRequestedAction());
streamDeck.actions.registerAction(new IssuesAssignedAction());
streamDeck.actions.registerAction(new NotificationsAction());
streamDeck.actions.registerAction(new CommitsAction());
streamDeck.actions.registerAction(new ReviewsDoneAction());
streamDeck.actions.registerAction(new StarsReceivedAction());
streamDeck.actions.registerAction(new StatusAction());
streamDeck.actions.registerAction(new OrgPrsOpenAction());
