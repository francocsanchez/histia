export interface WhatsAppProviderSendResult {
  id: string;
}

export interface WhatsAppProvider {
  sendText: (jid: string, text: string) => Promise<WhatsAppProviderSendResult>;
}
