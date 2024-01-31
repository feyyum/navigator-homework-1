import { Challenge } from './Challenge';
import { Field, Mina, PrivateKey, PublicKey, AccountUpdate } from 'o1js';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

let proofsEnabled = false;
let adminPrivKey = PrivateKey.fromBase58(
  'EKEdDGiN9Zd9TaSPcNjs3nB6vs9JS3WCgdsrfyEeLcQpnXNR7j6E'
);
let adminAcc = adminPrivKey.toPublicKey();
describe('Challenge', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    adminAccount: PublicKey,
    adminKey: PrivateKey,
    bobAccount: PublicKey,
    bobKey: PrivateKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: Challenge;

  beforeAll(async () => {
    if (proofsEnabled) await Challenge.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    ({ privateKey: bobKey, publicKey: bobAccount } = Local.testAccounts[2]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new Challenge(zkAppAddress);
    adminKey = PrivateKey.fromBase58(
      'EKEdDGiN9Zd9TaSPcNjs3nB6vs9JS3WCgdsrfyEeLcQpnXNR7j6E'
    );
    adminAccount = adminKey.toPublicKey();
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  it('generates and deploys the `Challenge` smart contract', async () => {
    await localDeploy();
    const admin = zkApp.admin.get();
    expect(admin).toEqual(adminAccount);
  });

  it('correctly adds the new address as action on the `Challenge` smart contract', async () => {
    await localDeploy();

    expect(zkApp.addressCounter.get()).toEqual(Field(0));
    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.addAddress(adminKey, senderAccount);
    });
    await txn.prove();
    await txn.sign([deployerKey, adminKey]).send();

    const updatedAddressList = zkApp.reducer.getActions();
    expect(updatedAddressList[0][0].address).toEqual(senderAccount);
    expect(zkApp.addressCounter.get()).toEqual(Field(1));

    const txn2 = await Mina.transaction(deployerAccount, () => {
      zkApp.addAddress(adminKey, bobAccount);
    });
    await txn2.prove();
    await txn2.sign([deployerKey, adminKey]).send();
    expect(zkApp.addressCounter.get()).toEqual(Field(2));

    // Use the same address to add and fail
    let errorMsg = '';
    const tx3 = await Mina.transaction(deployerAccount, () => {
      zkApp.addAddress(adminKey, senderAccount);
    }).catch((e) => (errorMsg = e));
    expect(errorMsg).toEqual(Error('Field.assertEquals(): 1 != 0'));
  });

  it('correctly adds the new message as action on the `Challenge` smart contract', async () => {
    await localDeploy();

    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.addAddress(adminKey, senderAccount);
    });
    await txn.prove();
    await txn.sign([deployerKey, adminKey]).send();

    expect(zkApp.messageCounter.get()).toEqual(Field(0));
    const txn2 = await Mina.transaction(deployerAccount, () => {
      // Create a field with last 6 bits are following the message format rules
      // 0b10000000
      zkApp.createMessage(senderKey, Field(0b11000000));
    });
    await txn2.prove();
    await txn2.sign([deployerKey]).send();

    const updatedMessageList = zkApp.reducer.getActions();
    expect(updatedMessageList[1][0].message).toEqual(Field(0b11000000));
    expect(zkApp.messageCounter.get()).toEqual(Field(1));
    let errorMsg = '';
    expect(
      await Mina.transaction(deployerAccount, () => {
        // Create a field with last 6 bits are following the message format rules
        // 0b10000000
        zkApp.createMessage(senderKey, Field(0b11000000));
      }).catch((e) => (errorMsg = e))
    );
    expect(errorMsg).toEqual(Error('Field.assertEquals(): 2 != 1'));
  });

  it('correctly checks if message format is right', async () => {
    await localDeploy();

    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.addAddress(adminKey, senderAccount);
    });
    await txn.prove();
    await txn.sign([deployerKey, adminKey]).send();

    expect(zkApp.messageCounter.get()).toEqual(Field(0));
    let errorMsg = '';
    await Mina.transaction(deployerAccount, () => {
      // Create a field with last 6 bits are not following the message format rules
      // 0b10000000
      zkApp.checkMessageFormat(Field(0b1111111));
    }).catch((e) => (errorMsg = e));
    expect(errorMsg).toEqual(Error('Bool.assertEquals(): true != false'));

    errorMsg = '';
    await Mina.transaction(deployerAccount, () => {
      // Create a field with last 6 bits are not following the message format rules
      // 0b10000000
      zkApp.checkMessageFormat(Field(0b11000000));
    }).catch((e) => (errorMsg = e));
    expect(errorMsg).toEqual('');

    errorMsg = '';
    await Mina.transaction(deployerAccount, () => {
      // Create a field with last 6 bits are not following the message format rules
      // 0b10000000
      zkApp.checkMessageFormat(Field(0b11111110000111));
    }).catch((e) => (errorMsg = e));
    expect(errorMsg).toEqual(Error('Bool.assertEquals(): true != false'));

    errorMsg = '';
    await Mina.transaction(deployerAccount, () => {
      // Create a field with last 6 bits are not following the message format rules
      // 0b10000000
      zkApp.checkMessageFormat(Field(0b1111111000110));
    }).catch((e) => (errorMsg = e));
    expect(errorMsg).toEqual(Error('Bool.assertEquals(): true != false'));

    errorMsg = '';
    await Mina.transaction(deployerAccount, () => {
      // Create a field with last 6 bits are not following the message format rules
      // 0b10000000
      zkApp.checkMessageFormat(Field(0b11111110011000));
    }).catch((e) => (errorMsg = e));
    expect(errorMsg).toEqual('');
    errorMsg = '';
    await Mina.transaction(deployerAccount, () => {
      // Create a field with last 6 bits are not following the message format rules
      // 0b10000000
      zkApp.checkMessageFormat(Field(0b11111110010000));
    }).catch((e) => (errorMsg = e));
    expect(errorMsg).toEqual(Error('Bool.assertEquals(): true != false'));
  });
});
