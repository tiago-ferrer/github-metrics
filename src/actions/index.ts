// Barrel de registro das actions. Cada arquivo se registra via `streamDeck.actions.registerAction`
// ao ser importado (decorator @action). Preenchido incrementalmente na Fase 2 do STEPS.md.
import streamDeck from "@elgato/streamdeck";
import { PrsOpenAction } from "./prs-open.js";

streamDeck.actions.registerAction(new PrsOpenAction());
