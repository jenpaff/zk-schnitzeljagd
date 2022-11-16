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
  Experimental,
} from 'snarkyjs';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

const height = 3;
const TestTree = new Experimental.MerkleTree(height);
class TestMerkleWitness extends Experimental.MerkleWitness(height) {}

let solution1Map = new Map<string, number>();
solution1Map.set('3669811487353460', 0);
solution1Map.set('3669811487352959', 1);
solution1Map.set('3669811487353435', 2);

TestTree.setLeaf(
  BigInt(0),
  Field(
    '16077998167343028646553135557584000622885794069175355468859880643191246902648'
  )
);
TestTree.setLeaf(
  BigInt(1),
  Field(
    '4959863211293764835981522120121170127998735725904090891639971960790493692203'
  )
);
TestTree.setLeaf(
  BigInt(2),
  Field(
    '9701086696850912768974935365193163925219115828058727347233540734990262902986'
  )
);

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
    zkAppInstance.init(TestTree.getRoot());
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
    const root = zkAppInstance.treeRoot.get();
    expect(root).toEqual(TestTree.getRoot());
    const isSolved = zkAppInstance.solved.get();
    expect(isSolved).toEqual(Bool(false));
  });

  describe('checkIn', () => {
    it('correctly updates the states on the `CheckInApp` smart contract if location is exactly the same', async () => {
      const zkAppInstance = new CheckInApp(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
      const locationInstance = new LocationCheck(48.2107958217, 16.3736155926);
      const txn = await Mina.transaction(deployerAccount, () => {
        let idx = solution1Map.get(locationInstance.sharedGeoHash.toString());
        if (idx == undefined) {
          return;
        }
        let witness = new TestMerkleWitness(TestTree.getWitness(BigInt(idx)));

        zkAppInstance.checkIn(locationInstance, witness);
        zkAppInstance.sign(zkAppPrivateKey);
      });
      await txn.send().wait();

      const isSolved = zkAppInstance.solved.get();
      expect(isSolved).toEqual(Bool(true));
    });

    /*
     * test with a range of geoHashes
     */

    it('correctly updates the states on the `CheckInApp` smart contract if location is within valid longitude range', async () => {
      const zkAppInstance = new CheckInApp(zkAppAddress);
      const locationInstance = new LocationCheck(48.2107932866, 16.3736870885); // move a bit east
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
      const txn = await Mina.transaction(deployerAccount, () => {
        let idx = solution1Map.get(locationInstance.sharedGeoHash.toString());
        if (idx == undefined) {
          return;
        }
        let witness = new TestMerkleWitness(TestTree.getWitness(BigInt(idx)));

        zkAppInstance.checkIn(locationInstance, witness);
        zkAppInstance.sign(zkAppPrivateKey);
      });
      await txn.send().wait();

      const isSolved = zkAppInstance.solved.get();
      expect(isSolved).toEqual(Bool(true));
    });

    it('correctly updates the states on the `CheckInApp` smart contract if location is within valid latitude range', async () => {
      const zkAppInstance = new CheckInApp(zkAppAddress);
      const locationInstance = new LocationCheck(48.2107906043, 16.373681724); // move a bit east
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
      const txn = await Mina.transaction(deployerAccount, () => {
        let idx = solution1Map.get(locationInstance.sharedGeoHash.toString());
        if (idx == undefined) {
          return;
        }
        let witness = new TestMerkleWitness(TestTree.getWitness(BigInt(idx)));

        zkAppInstance.checkIn(locationInstance, witness);
        zkAppInstance.sign(zkAppPrivateKey);
      });
      await txn.send().wait();

      const isSolved = zkAppInstance.solved.get();
      expect(isSolved).toEqual(Bool(true));
    });
  });
});
