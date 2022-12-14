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
 * Inspired by https://docs.minaprotocol.com/zkapps
 *
 * Below you will find the Schnitzel contract. On initialization it requires the
 * Merkleroot of the solution trees, one solution tree per riddle presented.
 *
 * When the hunt method is called, the contract will verify whether the passed location is indeed
 * a valid solution by evaluating the merkle proof and increase the step count by one if successful.
 *
 * When the finish method is called, we check whether all steps have been completed
 * and set finish to true if successful.
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

  constructor(geoHash: number) {
    super();
    // var geoHash: number = geohash.encode_int(lat, long);
    this.sharedGeoHash = Field(geoHash);
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

type SchnitzelInterface = {
  hunt(
    // eslint-disable-next-line
    feePayer: PrivateKey,
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
  finish(feePayer: PrivateKey, doProof: boolean): Promise<void>;
};

async function deployApp(
  feePayer: PrivateKey,
  solution1Root: Field,
  solution2Root: Field,
  solution3Root: Field,
  doProof: boolean
) {
  console.log('Deploying Checkin App ....');
  console.log('Merkle root 1 ' + solution1Root);
  console.log('Merkle root 2 ' + solution2Root);
  console.log('Merkle root 3 ' + solution3Root);

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
      feePayer: PrivateKey,
      sharedLocation: LocationCheck,
      solution1Map: Map<string, number>,
      solution2Map: Map<string, number>,
      solution3Map: Map<string, number>,
      step: number,
      doProof: boolean
    ) {
      return hunt(
        feePayer,
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
    finish(feePayer: PrivateKey, doProof: boolean) {
      return finish(feePayer, zkappKey, zkappAddress, doProof);
    },
    getState() {
      return getState(zkappAddress);
    },
  };

  let zkapp = new SchnitzelHuntApp(zkappAddress);

  try {
    let tx = await Mina.transaction(feePayer, () => {
      console.log('Funding account');
      AccountUpdate.fundNewAccount(feePayer);
      console.log('Deploying smart contract...');
      if (!doProof) {
        tic('deploy');
        zkapp.deploy({ zkappKey });
        zkapp.setPermissions({
          ...Permissions.default(),
          editState: Permissions.proofOrSignature(),
        });
        toc();
      } else {
        tic('deploy');
        zkapp.deploy({ verificationKey, zkappKey });
        toc();
      }
    });
    await tx.send().wait();

    console.log('Deployment successful!');
  } catch (error) {
    console.error('Error deploying app ' + error);
  }

  try {
    let txn = await Mina.transaction(feePayer, () => {
      console.log('Initialising smart contract...');
      zkapp.init(solution1Root, solution2Root, solution3Root);
      if (!doProof) zkapp.sign(zkappKey);
    });
    if (doProof) {
      tic('prove');
      await txn.prove().then((tx) => {
        tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
      });
      toc();
    }
    await txn.send().wait();

    console.log('Contract successfully deployed and initialized!');
  } catch (error) {
    console.error('Error initialising app ' + error);
  }

  return zkappInterface;
}

async function hunt(
  feePayer: PrivateKey,
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
          witness = new MerkleWitness(Solution1Tree.getWitness(BigInt(+idx)));
          break;
        case 1:
          console.log('attempt to solve step 1');
          idx = solution2Map.get(sharedLocation.sharedGeoHash.toString());
          if (idx == undefined) {
            throw console.log('Location shared is incorrect!');
          }
          witness = new MerkleWitness(Solution2Tree.getWitness(BigInt(+idx)));
          break;
        case 2:
          console.log('attempt to solve step 2');
          idx = solution3Map.get(sharedLocation.sharedGeoHash.toString());
          if (idx == undefined) {
            throw console.log('Location shared is incorrect!');
          }
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
  feePayer: PrivateKey,
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
  console.log('generating solution tree...');
  let solutionMap = new Map<string, number>();
  const solution = geohash
    .bboxes_int(minlat, minlong, maxlat, maxlong)
    .toString()
    .split(',');
  for (let index = 0; index < solution.length; index++) {
    let map_index = BigInt(index);
    let hash = Poseidon.hash(Field(+solution[index]).toFields());
    solutionMap.set(solution[index], index);
    tree.setLeaf(map_index, hash);
  }
  console.log('finished merkle tree generation');
  return solutionMap;
}
