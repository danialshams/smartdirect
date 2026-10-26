/** SMS transport is deliberately inactive until a provider has been purchased and configured. */
export type SmsSendRequest={phone:string;text:string;reference:string};
export type SmsSendReceipt={reference:string;providerMessageId:string};
export interface SmsProvider{sendBatch(messages:SmsSendRequest[]):Promise<SmsSendReceipt[]>;getName():string}
/** Never treat draft creation as a real outgoing SMS. No provider or credentials are configured. */
export function getSmsProvider():SmsProvider|null{return null;}
