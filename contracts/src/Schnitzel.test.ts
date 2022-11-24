import { SchnitzelHuntApp, LocationCheck } from './Schnitzel';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Bool,
  MerkleTree,
  MerkleWitness,
  UInt32,
} from 'snarkyjs';
import geohash from 'ngeohash';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

let proofsEnabled = false;

const height = 3;
const TestTree1 = new MerkleTree(height);
const TestTree2 = new MerkleTree(height);
const TestTree3 = new MerkleTree(height);
class TestMerkleWitness extends MerkleWitness(height) {}

let solution1Map = new Map<string, number>();
solution1Map.set('3669811486653801', 0); // 48.21073696017265,16.373611986637115
solution1Map.set('3669811487353409', 1); // 48.21077987551689,16.373665630817413
solution1Map.set('3669811487353732', 2); // 48.210804015398026,16.37370854616165

TestTree1.setLeaf(
  0n,
  Field(
    '6166174589607614516308361836754733633738565520449452769793840646233268800940'
  )
);
TestTree1.setLeaf(
  1n,
  Field(
    '15118923562589814738126022296109929047711772082649344103429463519139511326373'
  )
);
TestTree1.setLeaf(
  2n,
  Field(
    '11837919099452773578795736717129807359535357405278737195568640900396436319681'
  )
);

let solution2Map = new Map<string, number>();
solution2Map.set('3669811306920809', 0); // 48.20790454745293,16.371637880802155
solution2Map.set('3669811306921626', 1); // 48.20793405175209,16.371664702892303
solution2Map.set('3669811306921706', 2); // 48.20794478058815,16.371686160564423

TestTree2.setLeaf(
  BigInt(0),
  Field(
    '2970487140325248628280158376487410113014647069049628090455606076234374594606'
  )
);
TestTree2.setLeaf(
  BigInt(1),
  Field(
    '9226232952824817292985371497434776714085626138316633848531876802855073098753'
  )
);
TestTree2.setLeaf(
  BigInt(2),
  Field(
    '18259664346642959739261020473717865030720219522063670922489563626621612404023'
  )
);

let solution3Map = new Map<string, number>();
solution3Map.set('3669811486281806', 0); // 48.208550959825516,16.372394263744354
solution3Map.set('3669811486284106', 1); // 48.208588510751724,16.372565925121307
solution3Map.set('3669811486285149', 2); // 48.208693116903305,16.372560560703278

TestTree3.setLeaf(
  BigInt(0),
  Field(
    '17834190731081954293657238729936829229780226756980618607892392661659360066698'
  )
);
TestTree3.setLeaf(
  BigInt(1),
  Field(
    '3494198426191899341073865658746380340128962327009310811302243988802831099325'
  )
);
TestTree3.setLeaf(
  BigInt(2),
  Field(
    '13161966787717354679487188385369507262387758307739786185524939177507863464916'
  )
);

describe('Schnitzelhunt', () => {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey;
  let zkApp: SchnitzelHuntApp;

  beforeAll(async () => {
    await isReady;
    if (proofsEnabled) SchnitzelHuntApp.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    deployerAccount = Local.testAccounts[0].privateKey;
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new SchnitzelHuntApp(zkAppAddress);
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  async function localDeploy(
    zkAppPrivatekey: PrivateKey,
    deployerAccount: PrivateKey
  ) {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy({ zkappKey: zkAppPrivatekey });
      zkApp.initState(
        TestTree1.getRoot(),
        TestTree2.getRoot(),
        TestTree3.getRoot()
      );
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([zkAppPrivateKey]).send();
  }

  it('generates and deploys the `Schnitzel` smart contract', async () => {
    await localDeploy(zkAppPrivateKey, deployerAccount);
    const root1 = zkApp.solution1Root.get();
    expect(root1).toEqual(TestTree1.getRoot());
    const root2 = zkApp.solution2Root.get();
    expect(root2).toEqual(TestTree2.getRoot());
    const root3 = zkApp.solution3Root.get();
    expect(root3).toEqual(TestTree3.getRoot());
    const isSolved = zkApp.finished.get();
    expect(isSolved).toEqual(Bool(false));
    const step = zkApp.step.get();
    expect(step).toEqual(UInt32.zero);
  });

  describe('hunt', () => {
    it('correctly updates the states on the `SchnitzelApp` smart contract if locations shared is correct', async () => {
      await localDeploy(zkAppPrivateKey, deployerAccount);

      // solve riddle 1
      let sharedGeoHash = convert_location_to_geohash(
        48.21073696017265,
        16.373611986637115
      );
      const locationInstanceStep1 = { sharedGeoHash: sharedGeoHash };
      let txn = await Mina.transaction(deployerAccount, () => {
        let witness = getWitness(
          solution1Map,
          locationInstanceStep1,
          TestTree1
        );
        zkApp.hunt(locationInstanceStep1, witness);
      });
      await txn.prove();
      await txn.send();

      let isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(false));
      let step = zkApp.step.get();
      expect(step).toEqual(UInt32.one);

      // solve riddle 2
      sharedGeoHash = convert_location_to_geohash(
        48.20790454745293,
        16.371637880802155
      );
      const locationInstanceStep2 = { sharedGeoHash: sharedGeoHash };
      txn = await Mina.transaction(deployerAccount, () => {
        let witness = getWitness(
          solution2Map,
          locationInstanceStep2,
          TestTree2
        );
        zkApp.hunt(locationInstanceStep2, witness);
      });
      await txn.prove();
      await txn.send();

      isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(false));
      step = zkApp.step.get();
      expect(step).toEqual(UInt32.from(2));

      // solve riddle 3
      sharedGeoHash = convert_location_to_geohash(48.2085509598, 16.3723942637);
      const locationInstanceStep3 = { sharedGeoHash: sharedGeoHash };
      txn = await Mina.transaction(deployerAccount, () => {
        let witness = getWitness(
          solution3Map,
          locationInstanceStep3,
          TestTree3
        );
        zkApp.hunt(locationInstanceStep3, witness);
      });
      await txn.prove();
      await txn.send();

      isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(false));
      step = zkApp.step.get();
      expect(step).toEqual(UInt32.from(3));

      // we can call finish after completing all riddles
      txn = await Mina.transaction(deployerAccount, () => {
        zkApp.finish();
      });
      await txn.prove();
      await txn.send();

      isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(true));
    });

    /*
     * test some error cases and different valid solution hashes
     */

    it('correctly rejects updating states on the `SchnitzelApp` smart contract if location is not within a valid range', async () => {
      await localDeploy(zkAppPrivateKey, deployerAccount);

      // solve riddle 1 with wrong location
      let sharedGeoHash = convert_location_to_geohash(
        48.4107369601,
        16.4736119866
      );
      const wronglocationInstanceStep1 = { sharedGeoHash: sharedGeoHash };
      try {
        let txn = await Mina.transaction(deployerAccount, () => {
          let witness = getWitness(
            solution1Map,
            wronglocationInstanceStep1,
            TestTree1
          );
          zkApp.hunt(wronglocationInstanceStep1, witness);
        });
        await txn.prove();
        await txn.send();
      } catch (error) {
        // expect that root doesn't match
        expect(error).toStrictEqual(
          Error(
            '("Error: assert_equal: 22657597466788901698541444226807265236400668908396123932377849007837396179117 != 17656020856064086815035896224465840329125738486783685496353168480074520833807")'
          )
        );
      }

      let isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(false));
      let step = zkApp.step.get();
      expect(step).toEqual(UInt32.zero);

      // solve riddle 1 with correct location
      sharedGeoHash = convert_location_to_geohash(48.2108040153, 16.3737085461);
      const correctlocationInstanceStep1 = { sharedGeoHash: sharedGeoHash };
      let txn = await Mina.transaction(deployerAccount, () => {
        let witness = getWitness(
          solution1Map,
          correctlocationInstanceStep1,
          TestTree1
        );
        zkApp.hunt(correctlocationInstanceStep1, witness);
      });
      await txn.prove();
      await txn.send();

      isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(false));
      step = zkApp.step.get();
      expect(step).toEqual(UInt32.one);

      // solve riddle 2 with wrong location
      try {
        sharedGeoHash = convert_location_to_geohash(
          48.1079045474,
          16.5716378808
        );
        const wronglocationInstanceStep2 = { sharedGeoHash: sharedGeoHash };
        txn = await Mina.transaction(deployerAccount, () => {
          let witness = getWitness(
            solution2Map,
            wronglocationInstanceStep2,
            TestTree2
          );
          zkApp.hunt(wronglocationInstanceStep2, witness);
        });
        await txn.prove();
        await txn.send();
      } catch (error) {
        // expect that root doesn't match
        expect(error).toStrictEqual(
          Error(
            '("Error: assert_equal: 12450753627767813975741190557151559350681694354027338769272917929121905952769 != 14268066528091662890027047620939943019380177103199989768045413836168034287304")'
          )
        );
      }

      isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(false));
      step = zkApp.step.get();
      expect(step).toEqual(UInt32.from(1));

      // solve riddle 2 with correct location
      sharedGeoHash = convert_location_to_geohash(48.2079447806, 16.3716861606);
      const correctLocationInstanceStep2 = { sharedGeoHash: sharedGeoHash };

      txn = await Mina.transaction(deployerAccount, () => {
        let witness = getWitness(
          solution2Map,
          correctLocationInstanceStep2,
          TestTree2
        );
        zkApp.hunt(correctLocationInstanceStep2, witness);
      });
      await txn.prove();
      await txn.send();

      isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(false));
      step = zkApp.step.get();
      expect(step).toEqual(UInt32.from(2));

      try {
        // solve riddle 3 with incorrect location
        sharedGeoHash = convert_location_to_geohash(
          48.5085509598,
          16.5723942638
        );
        const wrongLocationInstanceStep3 = { sharedGeoHash: sharedGeoHash };

        txn = await Mina.transaction(deployerAccount, () => {
          let witness = getWitness(
            solution3Map,
            wrongLocationInstanceStep3,
            TestTree3
          );
          zkApp.hunt(wrongLocationInstanceStep3, witness);
        });
        await txn.prove();
        await txn.send();
      } catch (error) {
        // expect that root doesn't match
        expect(error).toStrictEqual(
          Error(
            '("Error: assert_equal: 23867771434367343257362585493375571467942581425112907504449115288292565011345 != 16454777920246234065520595127497798292309796033122497158590148125087442439225")'
          )
        );
      }

      isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(false));
      step = zkApp.step.get();
      expect(step).toEqual(UInt32.from(2));

      // we can't call finish because we haven't completed all steps yet
      try {
        txn = await Mina.transaction(deployerAccount, () => {
          zkApp.finish();
        });
        await txn.prove();
        await txn.send();
      } catch (error) {
        // expect that root doesn't match
        expect(error).toStrictEqual(Error('assert_equal: 2 != 3'));
      }
      isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(false));

      // solve riddle 3 with correct location
      sharedGeoHash = convert_location_to_geohash(48.208693117, 16.3725605607);
      const locationInstanceStep3 = { sharedGeoHash: sharedGeoHash };

      txn = await Mina.transaction(deployerAccount, () => {
        let witness = getWitness(
          solution3Map,
          locationInstanceStep3,
          TestTree3
        );
        zkApp.hunt(locationInstanceStep3, witness);
      });
      await txn.prove();
      await txn.send();

      isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(false));
      step = zkApp.step.get();
      expect(step).toEqual(UInt32.from(3));

      // we can call finish after completing all riddles
      txn = await Mina.transaction(deployerAccount, () => {
        zkApp.finish();
      });
      await txn.prove();
      await txn.send();

      isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(true));
    });

    it('rejects setting the `SchnitzelApp` to finish() when not all steps were completed', async () => {
      const zkApp = new SchnitzelHuntApp(zkAppAddress);
      await localDeploy(zkAppPrivateKey, deployerAccount);

      try {
        let txn = await Mina.transaction(deployerAccount, () => {
          zkApp.finish();
        });
        await txn.prove();
        await txn.send();
      } catch (error) {
        expect(error).toStrictEqual(Error('assert_equal: 0 != 3'));
      }

      const isSolved = zkApp.finished.get();
      expect(isSolved).toEqual(Bool(false));
    });
  });
});

function getWitness(
  solutionMap: Map<string, number>,
  location: LocationCheck,
  tree: MerkleTree
): TestMerkleWitness {
  let idx = solutionMap.get(location.sharedGeoHash.toString());
  if (idx == undefined) {
    idx = 0; // set to 0 such that we can test error cases
  }
  console.log('idx ' + idx);
  console.log('shared geohash ' + location.sharedGeoHash.toString());
  let witness = new TestMerkleWitness(tree.getWitness(BigInt(idx)));
  return witness;
}

export function convert_location_to_geohash(lat: number, long: number): Field {
  var geoHash: number = geohash.encode_int(lat, long);
  return Field(geoHash);
}
