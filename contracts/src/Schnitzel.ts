import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  isReady,
  Bool,
  PrivateKey,
  Mina,
  PublicKey,
  AccountUpdate,
  Poseidon,
  Circuit,
  UInt32,
  Struct,
  MerkleTree,
  MerkleWitness,
} from 'snarkyjs';
import geohash from 'ngeohash';
import { tic, toc } from './tictoc.js';

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
  MyMerkleWitness,
  Solution1Tree,
  Solution2Tree,
  Solution3Tree,
};
export type { SchnitzelInterface };

const height = 11;
const Solution1Tree = new MerkleTree(height);
const Solution2Tree = new MerkleTree(height);
const Solution3Tree = new MerkleTree(height);
class MyMerkleWitness extends MerkleWitness(height) {}

export class LocationCheck extends Struct({
  sharedGeoHash: Field,
}) {
  static hash(sharedGeoHash: Field): Field {
    return Poseidon.hash(sharedGeoHash.toFields());
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

  @method initState(
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

  @method hunt(locationCheckInstance: LocationCheck, path: MyMerkleWitness) {
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
    sharedLocation: LocationCheck,
    // eslint-disable-next-line
    solution1Map: Map<string, number>,
    // eslint-disable-next-line
    solution2Map: Map<string, number>,
    // eslint-disable-next-line
    solution3Map: Map<string, number>,
    // eslint-disable-next-line
    step: number
  ): Promise<void>;
  getState(): { solved: boolean; step: string };
  // eslint-disable-next-line
  finish(): Promise<void>;
};

async function deployApp(
  feePayer: PrivateKey,
  solution1Root: Field,
  solution2Root: Field,
  solution3Root: Field,
  proofsEnabled: boolean
) {
  console.log('Deploying Checkin App ....');
  console.log('Merkle root 1 ' + solution1Root);
  console.log('Merkle root 2 ' + solution2Root);
  console.log('Merkle root 3 ' + solution3Root);

  let zkappKey = PrivateKey.random();
  let zkappAddress = zkappKey.toPublicKey();

  let verificationKey: any;

  if (proofsEnabled) {
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
      step: number
    ) {
      return hunt(
        feePayer,
        zkappAddress,
        sharedLocation,
        solution1Map,
        solution2Map,
        solution3Map,
        step
      );
    },
    finish() {
      return finish(feePayer, zkappAddress);
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
      tic('deploy');
      zkapp.deploy({ verificationKey, zkappKey });
      toc();
    });
    await tx.send();

    console.log('Deployment successful!');
  } catch (error) {
    console.error('Error deploying app ' + error);
  }

  try {
    let txn = await Mina.transaction(feePayer, () => {
      console.log('Initialising smart contract...');
      zkapp.initState(solution1Root, solution2Root, solution3Root);
    });
    tic('prove');
    await txn.prove().then((tx) => {
      tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
    });
    toc();
    await txn.send();

    console.log('Contract successfully deployed and initialized!');
  } catch (error) {
    console.error('Error initialising app ' + error);
  }

  return zkappInterface;
}

async function hunt(
  feePayer: PrivateKey,
  zkappAddress: PublicKey,
  sharedLocation: LocationCheck,
  solution1Map: Map<string, number>,
  solution2Map: Map<string, number>,
  solution3Map: Map<string, number>,
  step: number // should be UInt32?
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
          witness = new MyMerkleWitness(Solution1Tree.getWitness(BigInt(+idx)));
          break;
        case 1:
          console.log('attempt to solve step 1');
          idx = solution2Map.get(sharedLocation.sharedGeoHash.toString());
          if (idx == undefined) {
            throw console.log('Location shared is incorrect!');
          }
          witness = new MyMerkleWitness(Solution2Tree.getWitness(BigInt(+idx)));
          break;
        case 2:
          console.log('attempt to solve step 2');
          idx = solution3Map.get(sharedLocation.sharedGeoHash.toString());
          if (idx == undefined) {
            throw console.log('Location shared is incorrect!');
          }
          witness = new MyMerkleWitness(Solution3Tree.getWitness(BigInt(+idx)));
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
    });
    tic('prove');
    await txn.prove().then((tx) => {
      tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
    });
    toc();
    await txn.send();
  } catch (err) {
    console.log('Solution rejected!');
    console.error('Solution rejected: ' + err);
  }
}

async function finish(feePayer: PrivateKey, zkappAddress: PublicKey) {
  console.log('Initiating finish process...');
  let zkapp = new SchnitzelHuntApp(zkappAddress);
  try {
    let txn = await Mina.transaction(feePayer, () => {
      zkapp.finish();
    });
    tic('prove');
    await txn.prove().then((tx) => {
      tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
    });
    toc();
    await txn.send();
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

export function convert_location_to_geohash(lat: number, long: number): Field {
  var geoHash: number = geohash.encode_int(lat, long);
  return Field(geoHash);
}
