import { getTrialAppChannel as dbGetChannel, setTrialAppChannel as dbSetChannel, getForms as dbGetForms, getForm as dbGetForm, addForm as dbAddForm, removeForm as dbRemoveForm } from './db';

export function getTrialAppChannel(guildId: string): string | null {
  return dbGetChannel(guildId);
}

export function setTrialAppChannel(guildId: string, channelId: string | null) {
  dbSetChannel(guildId, channelId);
}

export function getForms(guildId: string): Array<{ name: string; questions: string[] }> {
  return dbGetForms(guildId);
}

export function getForm(guildId: string, name: string): { name: string; questions: string[] } | undefined {
  return dbGetForm(guildId, name);
}

export function addForm(guildId: string, form: { name: string; questions: string[] }) {
  dbAddForm(guildId, form);
}

export function removeForm(guildId: string, formName: string): boolean {
  return dbRemoveForm(guildId, formName);
}
