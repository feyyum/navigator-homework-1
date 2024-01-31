import { AccountUpdate, Mina, PrivateKey, PublicKey } from 'o1js';
import { Challenge } from './Challenge';

const doProofs = true;

let Local = Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);

// a test account that pays all the fees, and puts additional funds into the zkapp
let feePayerKey = Local.testAccounts[0].privateKey;
let feePayer = Local.testAccounts[0].publicKey;

let eligibleUser1Publickey = Local.testAccounts[1].publicKey;
let eligibleUser1Privatekey = Local.testAccounts[1].privateKey;
let eligibleUser2Publickey = Local.testAccounts[2].publicKey;
let eligibleUser2Privatekey = Local.testAccounts[2].privateKey;
let eligibleUser3 = Local.testAccounts[3].publicKey;

let adminPrivatekey = PrivateKey.fromBase58(
  'EKEdDGiN9Zd9TaSPcNjs3nB6vs9JS3WCgdsrfyEeLcQpnXNR7j6E'
);
let adminPublicKey = adminPrivatekey.toPublicKey();
// the zkapp account
let zkappKey = PrivateKey.fromBase58(
  'EKEQc95PPQZnMY9d9p1vq1MWLeDJKtvKj4V75UDG3rjnf32BerWD'
);
let zkappAddress = zkappKey.toPublicKey();
let zkapp = new Challenge(zkappAddress);
if (doProofs) {
  console.log('compile');
  await Challenge.compile();
} else {
  // TODO: if we don't do this, then `analyzeMethods()` will be called during `runUnchecked()` in the tx callback below,
  // which currently fails due to `finalize_is_running` in snarky not resetting internal state, and instead setting is_running unconditionally to false,
  // so we can't nest different snarky circuit runners
  Challenge.analyzeMethods();
}

console.log('deploy');

let tx = await Mina.transaction(feePayer, () => {
  AccountUpdate.fundNewAccount(feePayer);
  zkapp.deploy();
});
await tx.prove();
await tx.sign([feePayerKey, zkappKey]).send();

console.log('deployed');

// Add eligible address
tx = await Mina.transaction(adminPublicKey, () => {
  AccountUpdate.fundNewAccount(adminPublicKey);
  zkapp.addAddress(adminPrivatekey, eligibleUser1Publickey);
});
