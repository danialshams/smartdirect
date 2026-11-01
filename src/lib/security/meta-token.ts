// Node-only AES-GCM module: no client component imports this file.
import {createCipheriv,createDecipheriv,hkdfSync,randomBytes} from "node:crypto";
const PREFIX="daira-meta-enc1:";
function key():Buffer{
 const root=process.env.NEXTAUTH_SECRET;
 if(!root||root.length<32)throw new Error("META_DATA_ENCRYPTION_KEY_UNAVAILABLE");
 return Buffer.from(hkdfSync("sha256",Buffer.from(root),Buffer.from("daira-storage-v1"),Buffer.from("instagram-account-token"),32));
}
/** Backward compatible read while existing plaintext rows migrate. */
export function decryptMetaToken(value:string):string{
 if(!value.startsWith(PREFIX))return value;
 const parts=value.slice(PREFIX.length).split(".");
 if(parts.length!==3)throw Error("INVALID_ENCRYPTED_META_TOKEN");
 const [nonce,tag,payload]=parts.map(x=>Buffer.from(x,"base64url"));
 const decipher=createDecipheriv("aes-256-gcm",key(),nonce);
 decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(payload),decipher.final()]).toString("utf8");
}
export function encryptMetaToken(value:string):string{
 if(value.startsWith(PREFIX))return value;
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv);
 const ciphertext=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
 return PREFIX+[iv,cipher.getAuthTag(),ciphertext].map(b=>b.toString("base64url")).join(".");
}
export function isEncryptedMetaToken(value:string){return value.startsWith(PREFIX);}
