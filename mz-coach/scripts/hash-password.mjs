// Erzeugt APP_PASSWORD_HASH, SESSION_SECRET und MZ_TRESOR_KEY für .env.local
// Aufruf: npm run hash-password
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question("Neues App-Passwort: ", (password) => {
  rl.close();
  if (password.length < 10) {
    console.error("Bitte mindestens 10 Zeichen.");
    process.exit(1);
  }
  const N = 2 ** 15, r = 8, p = 1;
  const salt = randomBytes(16);
  scrypt(password, salt, 64, { N, r, p, maxmem: 256 * N * r }, (err, key) => {
    if (err) throw err;
    const hash = ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join(":");
    console.log("\nIn .env.local eintragen:\n");
    console.log(`APP_PASSWORD_HASH='${hash}'`);
    console.log(`SESSION_SECRET='${randomBytes(48).toString("base64url")}'`);
    console.log(`MZ_TRESOR_KEY='${randomBytes(32).toString("base64")}'`);
  });
});
