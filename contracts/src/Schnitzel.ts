import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  isReady,
  CircuitValue,
  prop,
  Bool,
  PrivateKey,
  Mina,
  PublicKey,
  AccountUpdate,
  Experimental,
  Poseidon,
  Circuit,
  UInt32,
} from 'snarkyjs';
import geohash from 'ngeohash';
import { tic, toc } from './tictoc.js';
import { MerkleTree } from 'snarkyjs/dist/node/lib/merkle_tree.js';

/**
 * Basic Example
 * See https://docs.minaprotocol.com/zkapps for more info.
 *
 * The Add contract initializes the state variable 'num' to be a Field(1) value by default when deployed.
 * When the 'update' method is called, the Add contract adds Field(2) to its 'num' contract state.
 *
 * This file is safe to delete and replace with your own contract.
 */

await isReady;

export {
  deployApp,
  MerkleWitness,
  Solution1Tree,
  Solution2Tree,
  Solution3Tree,
};
export type { SchnitzelInterface };

const height = 11;
const Solution1Tree = new Experimental.MerkleTree(height);
const Solution2Tree = new Experimental.MerkleTree(height);
const Solution3Tree = new Experimental.MerkleTree(height);
class MerkleWitness extends Experimental.MerkleWitness(height) {}

export class LocationCheck extends CircuitValue {
  @prop sharedGeoHash: Field;

  constructor(lat: number, long: number) {
    super();
    var geoHash: number = geohash.encode_int(lat, long);
    this.sharedGeoHash = Field(geoHash);
    console.log('shared location: ' + lat + ' ' + long);
    console.log('convert to geoHash: ' + this.sharedGeoHash);
    console.log(
      'geoHash hash: ' + Poseidon.hash(this.sharedGeoHash.toFields())
    );
  }

  hash(): Field {
    return Poseidon.hash(this.sharedGeoHash.toFields());
  }
}

export class SchnitzelHuntApp extends SmartContract {
  @state(Bool) finished = State<Bool>();
  @state(UInt32) step = State<UInt32>();
  @state(Field) solution1Root = State<Field>();
  @state(Field) solution2Root = State<Field>();
  @state(Field) solution3Root = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method init(
    solution1Root: Field,
    solution2Root: Field,
    solution3Root: Field
  ) {
    this.finished.set(new Bool(false));
    this.solution1Root.set(solution1Root);
    this.solution2Root.set(solution2Root);
    this.solution3Root.set(solution3Root);
    this.step.set(UInt32.zero);
  }

  @method hunt(locationCheckInstance: LocationCheck, path: MerkleWitness) {
    // check preconditions
    const isFinished = this.finished.get();
    this.finished.assertEquals(isFinished);
    isFinished.assertFalse(); // game shouldn't be over yet

    let step = this.step.get();
    this.step.assertEquals(step);
    step = step.add(UInt32.one);
    this.step.set(step);

    const solution1Root = this.solution1Root.get();
    this.solution1Root.assertEquals(solution1Root);

    const solution2Root = this.solution2Root.get();
    this.solution2Root.assertEquals(solution2Root);

    const solution3Root = this.solution3Root.get();
    this.solution3Root.assertEquals(solution3Root);

    const isFirstStep: Bool = step.equals(UInt32.one);
    const isSecondStep: Bool = step.equals(UInt32.from(2));
    const isThirdStep: Bool = step.equals(UInt32.from(3));

    const root_to_check = Circuit.switch(
      [isFirstStep, isSecondStep, isThirdStep],
      Field,
      [solution1Root, solution2Root, solution3Root]
    );

    path
      .calculateRoot(
        Poseidon.hash(locationCheckInstance.sharedGeoHash.toFields())
      )
      .assertEquals(root_to_check);

    // const isLastStep: Bool = step.equals(UInt32.from(2));
    // const finished = Circuit.if(isLastStep, Bool(true), Bool(false));
    // this.finished.set(finished);
  }

  @method finish() {
    // check preconditions
    const isFinished = this.finished.get();
    this.finished.assertEquals(isFinished);
    isFinished.assertFalse(); // should only be called when the game isn't done yet

    let step = this.step.get();
    this.step.assertEquals(step);
    step.assertEquals(UInt32.from(3)); // should be the last step

    this.finished.set(Bool(true));
  }
}

let Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);
const feePayer = Local.testAccounts[0].privateKey;

type SchnitzelInterface = {
  hunt(
    // eslint-disable-next-line
    sharedLocation: LocationCheck,
    // eslint-disable-next-line
    solution1Map: Map<string, number>,
    // eslint-disable-next-line
    solution2Map: Map<string, number>,
    // eslint-disable-next-line
    solution3Map: Map<string, number>,
    // eslint-disable-next-line
    step: number,
    // eslint-disable-next-line
    doProof: boolean
  ): Promise<void>;
  getState(): { solved: boolean; step: string };
  // eslint-disable-next-line
  finish(doProof: boolean): Promise<void>;
};

async function deployApp(
  solution1Root: Field,
  solution2Root: Field,
  solution3Root: Field,
  doProof: boolean
) {
  console.log('Deploying Checkin App ....');
  console.log('Merkle root 1 deployApp ' + solution1Root);
  console.log('Merkle root 2 deployApp ' + solution2Root);
  console.log('Merkle root 3 deployApp ' + solution3Root);

  let zkappKey = PrivateKey.random();
  let zkappAddress = zkappKey.toPublicKey();

  let verificationKey: any;

  if (doProof) {
    tic('compile');
    ({ verificationKey } = await SchnitzelHuntApp.compile());
    toc();
  }

  let zkappInterface = {
    hunt(
      sharedLocation: LocationCheck,
      solution1Map: Map<string, number>,
      solution2Map: Map<string, number>,
      solution3Map: Map<string, number>,
      step: number,
      doProof: boolean
    ) {
      return hunt(
        zkappKey,
        zkappAddress,
        sharedLocation,
        solution1Map,
        solution2Map,
        solution3Map,
        step,
        doProof
      );
    },
    finish(doProof: boolean) {
      return finish(zkappKey, zkappAddress, doProof);
    },
    getState() {
      return getState(zkappAddress);
    },
  };

  let zkapp = new SchnitzelHuntApp(zkappAddress);

  try {
    let tx = await Mina.transaction(feePayer, () => {
      console.log('Funding account with feePayer ' + feePayer.toJSON());
      AccountUpdate.fundNewAccount(feePayer);
      console.log('Deploying smart contract...');
      zkapp.deploy({ zkappKey: zkappKey, verificationKey });
      if (!doProof) {
        zkapp.deploy({ zkappKey });
        zkapp.setPermissions({
          ...Permissions.default(),
          editState: Permissions.proofOrSignature(),
        });
      } else {
        zkapp.deploy({ verificationKey, zkappKey });
      }
    });
    await tx.send().wait();

    console.log('Deployment successful!');
  } catch (error) {
    console.error('Error deploying app ' + error);
  }

  try {
    let tx = await Mina.transaction(feePayer, () => {
      console.log('Initialising smart contract...');
      zkapp.init(solution1Root, solution2Root, solution3Root);
      if (!doProof) zkapp.sign(zkappKey);
    });
    if (doProof) {
      console.log('proving...');
      await tx.prove();
    }
    await tx.send().wait();

    console.log('Contract successfully deployed and initialized!');
  } catch (error) {
    console.error('Error initialising app ' + error);
  }

  return zkappInterface;
}

async function hunt(
  zkappKey: PrivateKey,
  zkappAddress: PublicKey,
  sharedLocation: LocationCheck,
  solution1Map: Map<string, number>,
  solution2Map: Map<string, number>,
  solution3Map: Map<string, number>,
  step: number, // should be UInt32?
  doProof: boolean
) {
  console.log('Initiating schnitzelhunt process...');
  console.log('solution1Map ' + solution1Map.size);
  console.log('solution2Map ' + solution2Map.size);
  console.log('solution3Map ' + solution3Map.size);
  console.log('step ' + step);
  let zkapp = new SchnitzelHuntApp(zkappAddress);
  try {
    let txn = await Mina.transaction(feePayer, () => {
      let idx;
      let witness;

      switch (step) {
        case 0:
          console.log('attempt to solve step 0');
          idx = solution1Map.get(sharedLocation.sharedGeoHash.toString());
          if (idx == undefined) {
            throw console.log('Location shared is incorrect!');
          }
          console.log(
            'index: ' +
              idx +
              ' geohash: ' +
              sharedLocation.sharedGeoHash.toString()
          );
          witness = new MerkleWitness(Solution1Tree.getWitness(BigInt(+idx)));
          break;
        case 1:
          console.log('attempt to solve step 1');
          idx = solution2Map.get(sharedLocation.sharedGeoHash.toString());
          if (idx == undefined) {
            throw console.log('Location shared is incorrect!');
          }
          console.log(
            'index: ' +
              idx +
              ' geohash: ' +
              sharedLocation.sharedGeoHash.toString()
          );
          witness = new MerkleWitness(Solution2Tree.getWitness(BigInt(+idx)));
          break;
        case 2:
          console.log('attempt to solve step 2');
          idx = solution3Map.get(sharedLocation.sharedGeoHash.toString());
          if (idx == undefined) {
            throw console.log('Location shared is incorrect!');
          }
          console.log(
            'index: ' +
              idx +
              ' geohash: ' +
              sharedLocation.sharedGeoHash.toString()
          );
          witness = new MerkleWitness(Solution3Tree.getWitness(BigInt(+idx)));
          break;
        default:
          throw console.log('Invalid step: ' + step);
      }
      if (step == undefined || witness == undefined) {
        throw console.log(
          'Step invalid: ' + step + ' - Witness invalid: ' + witness
        );
      }
      zkapp.hunt(sharedLocation, witness);
      if (!doProof) {
        zkapp.sign(zkappKey);
      }
    });
    if (doProof) {
      tic('prove');
      await txn.prove().then((tx) => {
        tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
      });
      toc();
    }
    await txn.send().wait();
  } catch (err) {
    console.log('Solution rejected!');
    console.error('Solution rejected: ' + err);
  }
}

async function finish(
  zkappKey: PrivateKey,
  zkappAddress: PublicKey,
  doProof: boolean
) {
  console.log('Initiating finish process...');
  let zkapp = new SchnitzelHuntApp(zkappAddress);
  try {
    let txn = await Mina.transaction(feePayer, () => {
      zkapp.finish();
      if (!doProof) {
        zkapp.sign(zkappKey);
      }
    });
    if (doProof) {
      tic('prove');
      await txn.prove().then((tx) => {
        tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
      });
      toc();
    }
    await txn.send().wait();
  } catch (err) {
    console.log('Fininsh process rejected!');
    console.error(err);
  }
}

function getState(zkappAddress: PublicKey) {
  let zkapp = new SchnitzelHuntApp(zkappAddress);
  let solved = zkapp.finished.get().toBoolean();
  let step = zkapp.step.get().toString();
  return { solved, step };
}

export function generate_solution_tree(
  minlat: number,
  minlong: number,
  maxlat: number,
  maxlong: number,
  tree: MerkleTree
): Map<string, number> {
  let solutionMap = new Map<string, number>();
  const solution = geohash
    .bboxes_int(minlat, minlong, maxlat, maxlong)
    .toString()
    .split(',');
  console.log('length solution 1 ' + solution.length);
  for (let index = 0; index < solution.length; index++) {
    console.log('index: ' + index + ' geohash: ' + solution[index]);
    let map_index = BigInt(index);
    let hash = Poseidon.hash(Field(+solution[index]).toFields());
    console.log('index: ' + index + ' geohash HASH: ' + hash);
    solutionMap.set(solution[index], index);
    tree.setLeaf(map_index, hash);
  }
  return solutionMap;
}
