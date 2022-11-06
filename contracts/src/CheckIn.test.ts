import { CheckInApp, LocationCheck } from './CheckIn';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Bool,
} from 'snarkyjs';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

function createLocalBlockchain() {
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  return Local.testAccounts[0].privateKey;
}

async function localDeploy(
  zkAppInstance: CheckInApp,
  zkAppPrivatekey: PrivateKey,
  deployerAccount: PrivateKey
) {
  const txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkAppInstance.init();
    zkAppInstance.deploy({ zkappKey: zkAppPrivatekey });
    zkAppInstance.sign(zkAppPrivatekey);
  });
  await txn.send().wait();
}

describe('CheckIn', () => {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey;

  beforeEach(async () => {
    await isReady;
    deployerAccount = createLocalBlockchain();
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  it('generates and deploys the `CheckIn` smart contract', async () => {
    const zkAppInstance = new CheckInApp(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const geoHash = zkAppInstance.geoHash.get();
    expect(geoHash).toEqual(Field.fromNumber(3669811486280996));
    const checkedIn = zkAppInstance.checkedIn.get();
    expect(checkedIn).toEqual(Bool(false));
  });

  describe('checkIn', () => {
    it('correctly updates the states on the `CheckInApp` smart contract if location is exactly the same', async () => {
      const zkAppInstance = new CheckInApp(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
      const locationInstance = new LocationCheck(48.208487, 16.372571);
      const txn = await Mina.transaction(deployerAccount, () => {
        zkAppInstance.checkIn(locationInstance);
        zkAppInstance.sign(zkAppPrivateKey);
      });
      await txn.send().wait();

      const updatedCheck = zkAppInstance.checkedIn.get();
      expect(updatedCheck).toEqual(Bool(true));
    });

    /*
     * TODO: make sure we can assert to a range of geoHashes, otherwise the game would be pretty cumbersome
     */

    it.skip('correctly updates the states on the `CheckInApp` smart contract if location is within valid longitude range', async () => {
      const zkAppInstance = new CheckInApp(zkAppAddress);
      const locationInstance = new LocationCheck(48.208487, 16.372573); // move a bit east
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
      const txn = await Mina.transaction(deployerAccount, () => {
        zkAppInstance.checkIn(locationInstance);
        zkAppInstance.sign(zkAppPrivateKey);
      });
      await txn.send().wait();

      const updatedCheck = zkAppInstance.checkedIn.get();
      expect(updatedCheck).toEqual(Bool(true));
    });

    it.skip('correctly updates the states on the `CheckInApp` smart contract if location is within valid latitude range', async () => {
      const zkAppInstance = new CheckInApp(zkAppAddress);
      const locationInstance = new LocationCheck(48.208487, 16.37257); // move a bit east
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
      const txn = await Mina.transaction(deployerAccount, () => {
        zkAppInstance.checkIn(locationInstance);
        zkAppInstance.sign(zkAppPrivateKey);
      });
      await txn.send().wait();

      const updatedCheck = zkAppInstance.checkedIn.get();
      expect(updatedCheck).toEqual(Bool(true));
    });
  });
});
